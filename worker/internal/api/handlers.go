package api

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/labbed/worker/internal/clab"
	"github.com/labbed/worker/internal/config"
	"github.com/labbed/worker/internal/platformclient"
	"github.com/labbed/worker/internal/terraform"
)

// Handler handles incoming requests from the platform.
type Handler struct {
	clabService    *clab.Service
	tfService      *terraform.Service
	platformClient *platformclient.Client
	activeLabs     map[string]string // labID -> clabName
	mu             sync.RWMutex
}

// NewHandler creates a new API handler.
func NewHandler(clabService *clab.Service, tfService *terraform.Service, platformClient *platformclient.Client) *Handler {
	return &Handler{
		clabService:    clabService,
		tfService:      tfService,
		platformClient: platformClient,
		activeLabs:     make(map[string]string),
	}
}

// ActiveLabCount returns the number of active labs.
func (h *Handler) ActiveLabCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.activeLabs)
}

// DeployRequest is received from the platform.
type DeployRequest struct {
	LabID       string            `json:"labId" binding:"required"`
	ClabName    string            `json:"clabName" binding:"required"`
	Definition  string            `json:"definition" binding:"required"`
	BindFiles   map[string][]byte `json:"bindFiles"`
	CallbackURL string            `json:"callbackUrl"`
	Type        string            `json:"type"` // "network" (default) | "cloud"
}

// DestroyRequest is received from the platform.
type DestroyRequest struct {
	LabID       string `json:"labId" binding:"required"`
	ClabName    string `json:"clabName" binding:"required"`
	CallbackURL string `json:"callbackUrl"`
	CleanupOnly bool   `json:"cleanupOnly"` // if true, skip status callbacks
	Type        string `json:"type"`        // "network" (default) | "cloud"
}

// InspectRequest is received from the platform.
type InspectRequest struct {
	ClabName string `json:"clabName" binding:"required"`
}

// HandleDeploy handles lab deployment requests.
func (h *Handler) HandleDeploy(c *gin.Context) {
	var req DeployRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Enforce max concurrent labs
	maxLabs := config.AppConfig.MaxConcurrentLabs
	if maxLabs > 0 && h.ActiveLabCount() >= maxLabs {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "worker at capacity"})
		return
	}

	// Dispatch based on lab type
	if req.Type == "cloud" {
		h.mu.Lock()
		h.activeLabs[req.LabID] = req.ClabName
		h.mu.Unlock()

		c.JSON(http.StatusAccepted, gin.H{"message": "cloud deployment started"})
		go h.deployCloudAsync(req.LabID, req.ClabName, req.Definition)
		return
	}

	// Prepare topology file on disk
	topoPath, err := clab.PrepareTopologyFile(req.LabID, req.Definition, req.BindFiles)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Track active lab
	h.mu.Lock()
	h.activeLabs[req.LabID] = req.ClabName
	h.mu.Unlock()

	// Respond immediately, deploy async
	c.JSON(http.StatusAccepted, gin.H{"message": "deployment started"})

	// Deploy in background
	go h.deployAsync(req.LabID, req.ClabName, topoPath, req.Definition)
}

func (h *Handler) pushLog(ctx context.Context, labID, line, level string) {
	_ = h.platformClient.PushLog(ctx, platformclient.LogEntry{
		LabID: labID,
		Line:  line,
		Level: level,
	})
}

func (h *Handler) deployAsync(labID, clabName, topoPath, topoYAML string) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	// Push deploying status
	h.platformClient.PushStatus(ctx, platformclient.StatusUpdate{
		LabID: labID,
		State: "deploying",
	})

	h.pushLog(ctx, labID, "Preparing topology files...", "info")

	// Deploy using containerlab library
	h.pushLog(ctx, labID, "Deploying containerlab topology...", "info")
	nodes, err := h.clabService.Deploy(ctx, clab.DeployOptions{
		TopoPath: topoPath,
		LabOwner: "labbed",
	})

	if err != nil {
		log.Printf("deploy failed for lab %s: %v", labID, err)
		h.pushLog(ctx, labID, "Deployment failed: "+err.Error(), "error")

		// Clean up any partially-created containers
		h.pushLog(ctx, labID, "Cleaning up partial deployment...", "info")
		cleanupErr := h.clabService.Destroy(ctx, clab.DestroyOptions{
			LabName: clabName,
			Cleanup: true,
		})
		if cleanupErr != nil {
			log.Printf("cleanup after failed deploy for lab %s: %v", labID, cleanupErr)
		}
		clab.CleanupTopologyFiles(labID)

		errMsg := err.Error()
		h.platformClient.PushStatus(ctx, platformclient.StatusUpdate{
			LabID:        labID,
			State:        "failed",
			ErrorMessage: &errMsg,
		})

		h.mu.Lock()
		delete(h.activeLabs, labID)
		h.mu.Unlock()
		return
	}

	// Apply startup-configs to vrnetlab nodes (clab.Deploy doesn't wait for VMs)
	topoDir := filepath.Dir(topoPath)
	h.pushLog(ctx, labID, "Applying startup configs to VM nodes...", "info")
	h.clabService.ApplyStartupConfigs(ctx, topoDir, topoYAML, clabName)

	h.pushLog(ctx, labID, fmt.Sprintf("Containers created, pushing node info (%d nodes)...", len(nodes)), "info")

	// Convert to platform format and push nodes
	var platformNodes []platformclient.NodeInfo
	for _, n := range nodes {
		platformNodes = append(platformNodes, platformclient.NodeInfo{
			Name:        n.Name,
			Kind:        n.Kind,
			Image:       n.Image,
			ContainerID: n.ContainerID,
			IPv4:        n.IPv4,
			IPv6:        n.IPv6,
			State:       n.State,
		})
	}

	h.platformClient.PushNodes(ctx, platformclient.NodeUpdate{
		LabID: labID,
		Nodes: platformNodes,
	})

	// Push running status
	h.platformClient.PushStatus(ctx, platformclient.StatusUpdate{
		LabID: labID,
		State: "running",
	})

	h.pushLog(ctx, labID, "Lab deployed successfully", "info")
	log.Printf("lab %s deployed successfully with %d nodes", labID, len(nodes))
}

// HandleDestroy handles lab destruction requests.
func (h *Handler) HandleDestroy(c *gin.Context) {
	var req DestroyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Type == "cloud" {
		c.JSON(http.StatusAccepted, gin.H{"message": "cloud destroy started"})
		go h.destroyCloudAsync(req.LabID, req.CleanupOnly)
		return
	}

	c.JSON(http.StatusAccepted, gin.H{"message": "destroy started"})

	go h.destroyAsync(req.LabID, req.ClabName, req.CleanupOnly)
}

func (h *Handler) destroyAsync(labID, clabName string, cleanupOnly bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	if !cleanupOnly {
		h.pushLog(ctx, labID, "Stopping lab...", "info")
		h.platformClient.PushStatus(ctx, platformclient.StatusUpdate{
			LabID: labID,
			State: "stopping",
		})
	}

	log.Printf("destroying containers for lab %s (clab: %s, cleanupOnly: %v)", labID, clabName, cleanupOnly)

	// Try to destroy using the topology file on disk first (more reliable —
	// uses the actual clab name from the YAML, not the platform's clab_name field).
	// Fall back to lab name lookup if the topology file was already cleaned up.
	topoPath := clab.GetTopologyFilePath(labID)
	var err error
	if topoPath != "" {
		err = h.clabService.Destroy(ctx, clab.DestroyOptions{
			TopoPath: topoPath,
			Cleanup:  true,
		})
	} else {
		err = h.clabService.Destroy(ctx, clab.DestroyOptions{
			LabName: clabName,
			Cleanup: true,
		})
	}

	// Always clean up tracking and files regardless of success/failure
	clab.CleanupTopologyFiles(labID)
	h.mu.Lock()
	delete(h.activeLabs, labID)
	h.mu.Unlock()

	if err != nil {
		log.Printf("destroy failed for lab %s: %v", labID, err)
		if !cleanupOnly {
			h.pushLog(ctx, labID, "Destroy failed: "+err.Error(), "error")
			errMsg := err.Error()
			h.platformClient.PushStatus(ctx, platformclient.StatusUpdate{
				LabID:        labID,
				State:        "failed",
				ErrorMessage: &errMsg,
			})
		}
		return
	}

	if !cleanupOnly {
		h.platformClient.PushStatus(ctx, platformclient.StatusUpdate{
			LabID: labID,
			State: "stopped",
		})
		h.pushLog(ctx, labID, "Lab destroyed successfully", "info")
	}
	log.Printf("lab %s destroyed successfully (cleanupOnly: %v)", labID, cleanupOnly)
}

// HandleInspect handles lab inspection requests.
func (h *Handler) HandleInspect(c *gin.Context) {
	var req InspectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	nodes, err := h.clabService.Inspect(c.Request.Context(), req.ClabName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"nodes": nodes})
}

// ExecRequest is received from the platform to execute a command in a container.
type ExecRequest struct {
	LabID    string `json:"labId" binding:"required"`
	NodeName string `json:"nodeName" binding:"required"`
	Command  string `json:"command" binding:"required"`
	NodeKind string `json:"nodeKind"` // "linux", "mikrotik_ros", etc.
}

// HandleExec executes a command in a running container and returns output.
func (h *Handler) HandleExec(c *gin.Context) {
	var req ExecRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	var output string
	var err error

	if clab.IsVrnetlabKind(req.NodeKind) {
		output, err = h.clabService.VrnetlabExec(ctx, req.NodeName, req.Command, req.NodeKind)
	} else {
		output, err = h.clabService.Exec(ctx, req.NodeName, req.Command)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"output": output})
}

// CaptureRequest is received from the platform to capture packets on a container interface.
type CaptureRequest struct {
	NodeName  string `json:"nodeName" binding:"required"`
	Interface string `json:"interface" binding:"required"`
	Count     int    `json:"count"`
	Filter    string `json:"filter"`
}

// HandleCapture runs tcpdump on a container interface from the host namespace (containerlab-native).
func (h *Handler) HandleCapture(c *gin.Context) {
	var req CaptureRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	count := req.Count
	if count <= 0 {
		count = 50
	}
	if count > 1000 {
		count = 1000
	}

	// 25s timeout — leaves headroom before platform's 30s HTTP timeout
	ctx, cancel := context.WithTimeout(c.Request.Context(), 25*time.Second)
	defer cancel()

	output, err := h.clabService.Capture(ctx, req.NodeName, req.Interface, count, req.Filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"output": output})
}

// deployCloudAsync deploys a cloud lab using Moto + Terraform.
func (h *Handler) deployCloudAsync(labID, clabName, hcl string) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	h.platformClient.PushStatus(ctx, platformclient.StatusUpdate{
		LabID: labID,
		State: "deploying",
	})

	h.pushLog(ctx, labID, "Starting Moto (AWS emulator)...", "info")
	motoPort, err := h.tfService.StartMoto(labID)
	if err != nil {
		log.Printf("moto start failed for lab %s: %v", labID, err)
		h.pushLog(ctx, labID, "Failed to start Moto: "+err.Error(), "error")
		errMsg := err.Error()
		h.platformClient.PushStatus(ctx, platformclient.StatusUpdate{LabID: labID, State: "failed", ErrorMessage: &errMsg})
		h.mu.Lock()
		delete(h.activeLabs, labID)
		h.mu.Unlock()
		return
	}

	h.pushLog(ctx, labID, fmt.Sprintf("Moto running on port %d, preparing Terraform files...", motoPort), "info")
	_, err = h.tfService.PrepareTerraformFiles(labID, hcl, motoPort)
	if err != nil {
		log.Printf("terraform prepare failed for lab %s: %v", labID, err)
		h.pushLog(ctx, labID, "Failed to prepare Terraform files: "+err.Error(), "error")
		h.tfService.StopMoto(labID)
		h.tfService.CleanupFiles(labID)
		errMsg := err.Error()
		h.platformClient.PushStatus(ctx, platformclient.StatusUpdate{LabID: labID, State: "failed", ErrorMessage: &errMsg})
		h.mu.Lock()
		delete(h.activeLabs, labID)
		h.mu.Unlock()
		return
	}

	h.pushLog(ctx, labID, "Running terraform init + apply...", "info")
	resources, err := h.tfService.Deploy(ctx, labID)
	if err != nil {
		log.Printf("terraform deploy failed for lab %s: %v", labID, err)
		h.pushLog(ctx, labID, "Terraform apply failed: "+err.Error(), "error")
		h.tfService.Destroy(ctx, labID)
		h.tfService.StopMoto(labID)
		h.tfService.CleanupFiles(labID)
		errMsg := err.Error()
		h.platformClient.PushStatus(ctx, platformclient.StatusUpdate{LabID: labID, State: "failed", ErrorMessage: &errMsg})
		h.mu.Lock()
		delete(h.activeLabs, labID)
		h.mu.Unlock()
		return
	}

	h.pushLog(ctx, labID, fmt.Sprintf("Terraform applied, %d resources created", len(resources)), "info")

	// Push resources as nodes (reusing NodeInfo)
	var nodes []platformclient.NodeInfo
	for _, r := range resources {
		nodes = append(nodes, platformclient.NodeInfo{
			Name:        r.Name,
			Kind:        r.ResourceType,
			ContainerID: r.ResourceID,
			State:       r.State,
		})
	}
	h.platformClient.PushNodes(ctx, platformclient.NodeUpdate{
		LabID: labID,
		Nodes: nodes,
	})

	h.platformClient.PushStatus(ctx, platformclient.StatusUpdate{
		LabID: labID,
		State: "running",
	})
	h.pushLog(ctx, labID, "Cloud lab deployed successfully", "info")
	log.Printf("cloud lab %s deployed with %d resources", labID, len(resources))
}

// destroyCloudAsync destroys a cloud lab's Terraform resources and Moto container.
func (h *Handler) destroyCloudAsync(labID string, cleanupOnly bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	if !cleanupOnly {
		h.pushLog(ctx, labID, "Destroying cloud lab...", "info")
		h.platformClient.PushStatus(ctx, platformclient.StatusUpdate{
			LabID: labID,
			State: "stopping",
		})
	}

	log.Printf("destroying cloud lab %s (cleanupOnly: %v)", labID, cleanupOnly)

	err := h.tfService.Destroy(ctx, labID)
	h.tfService.StopMoto(labID)
	h.tfService.CleanupFiles(labID)

	h.mu.Lock()
	delete(h.activeLabs, labID)
	h.mu.Unlock()

	if err != nil {
		log.Printf("cloud destroy failed for lab %s: %v", labID, err)
		if !cleanupOnly {
			h.pushLog(ctx, labID, "Destroy failed: "+err.Error(), "error")
			errMsg := err.Error()
			h.platformClient.PushStatus(ctx, platformclient.StatusUpdate{LabID: labID, State: "failed", ErrorMessage: &errMsg})
		}
		return
	}

	if !cleanupOnly {
		h.platformClient.PushStatus(ctx, platformclient.StatusUpdate{LabID: labID, State: "stopped"})
		h.pushLog(ctx, labID, "Cloud lab destroyed successfully", "info")
	}
	log.Printf("cloud lab %s destroyed (cleanupOnly: %v)", labID, cleanupOnly)
}

// AwsExecRequest is received from the platform to run AWS CLI commands.
type AwsExecRequest struct {
	LabID   string `json:"labId" binding:"required"`
	Command string `json:"command" binding:"required"`
}

// HandleAwsExec runs an AWS CLI command against a lab's Moto endpoint.
func (h *Handler) HandleAwsExec(c *gin.Context) {
	var req AwsExecRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	motoPort := h.tfService.GetMotoPort(req.LabID)
	if motoPort == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "no moto instance for this lab"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	output, err := h.tfService.AwsExec(ctx, req.LabID, req.Command, motoPort)
	if err != nil {
		// Return output even on error
		c.JSON(http.StatusOK, gin.H{"output": output, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"output": output})
}

// HandleHealth returns worker health status.
func (h *Handler) HandleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":     "ok",
		"activeLabs": h.ActiveLabCount(),
	})
}
