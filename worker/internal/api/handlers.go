package api

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/labbed/worker/internal/clab"
	"github.com/labbed/worker/internal/config"
	"github.com/labbed/worker/internal/platformclient"
)

// Handler handles incoming requests from the platform.
type Handler struct {
	clabService    *clab.Service
	platformClient *platformclient.Client
	activeLabs     map[string]string // labID -> clabName
	mu             sync.RWMutex
}

// NewHandler creates a new API handler.
func NewHandler(clabService *clab.Service, platformClient *platformclient.Client) *Handler {
	return &Handler{
		clabService:    clabService,
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
	Topology    string            `json:"topology" binding:"required"`
	BindFiles   map[string][]byte `json:"bindFiles"`
	CallbackURL string            `json:"callbackUrl"`
}

// DestroyRequest is received from the platform.
type DestroyRequest struct {
	LabID       string `json:"labId" binding:"required"`
	ClabName    string `json:"clabName" binding:"required"`
	CallbackURL string `json:"callbackUrl"`
	CleanupOnly bool   `json:"cleanupOnly"` // if true, skip status callbacks
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

	// Prepare topology file on disk
	topoPath, err := clab.PrepareTopologyFile(req.LabID, req.Topology, req.BindFiles)
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
	go h.deployAsync(req.LabID, req.ClabName, topoPath)
}

func (h *Handler) pushLog(ctx context.Context, labID, line, level string) {
	_ = h.platformClient.PushLog(ctx, platformclient.LogEntry{
		LabID: labID,
		Line:  line,
		Level: level,
	})
}

func (h *Handler) deployAsync(labID, clabName, topoPath string) {
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
	err := h.clabService.Destroy(ctx, clab.DestroyOptions{
		LabName: clabName,
		Cleanup: true,
	})

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
	LabID     string `json:"labId" binding:"required"`
	NodeName  string `json:"nodeName" binding:"required"`
	Command   string `json:"command" binding:"required"`
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

	output, err := h.clabService.Exec(ctx, req.NodeName, req.Command)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
