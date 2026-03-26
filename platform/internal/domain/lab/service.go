package lab

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labbed/platform/internal/domain/worker"
	"github.com/labbed/platform/internal/plan"
	"github.com/labbed/platform/internal/workerclient"
	"gopkg.in/yaml.v3"
)

// WorkerSelector is a minimal interface for worker selection, keeping the lab
// service decoupled from the full worker service for testability.
type WorkerSelector interface {
	SelectWorker() (*worker.Worker, error)
	GetWorkerByID(id uint) (*worker.Worker, error)
}

// TemplateLoader loads topology definitions and bind files for deploy dispatch.
type TemplateLoader interface {
	GetType(topoUUID string) (string, error)                                          // returns "network" or "cloud"
	GetDefinition(topoUUID string) (string, error)                                    // returns YAML/HCL definition
	GetBindFiles(topoUUID string) (map[string][]byte, error)                          // filePath -> content
	GetBindFilesForNos(topoUUID string, nosKinds []string) (map[string][]byte, error) // filtered by NOS kind
}

// NosImageResolver resolves a NOS image UUID to its clab kind and docker image.
type NosImageResolver interface {
	ResolveImage(uuid string) (clabKind, dockerImage string, err error)
}

// PlanResolver returns the plan name for an org.
type PlanResolver interface {
	GetOrgPlan(orgID uint) string
}

type LabService struct {
	repo             *LabRepository
	workerSelector   WorkerSelector
	workerClient     *workerclient.Client
	templateLoader       TemplateLoader
	platformURL      string // base URL for worker callbacks
	nosImageResolver NosImageResolver
	planResolver     PlanResolver
}

func NewService(repo *LabRepository, workerSelector WorkerSelector, wc *workerclient.Client, tl TemplateLoader, platformURL string) *LabService {
	return &LabService{
		repo:           repo,
		workerSelector: workerSelector,
		workerClient:   wc,
		templateLoader:     tl,
		platformURL:    platformURL,
	}
}

// SetNosImageResolver sets the NOS image resolver for deploy-time overrides.
func (s *LabService) SetNosImageResolver(resolver NosImageResolver) {
	s.nosImageResolver = resolver
}

// SetPlanResolver sets the plan resolver for deploy-time enforcement.
func (s *LabService) SetPlanResolver(resolver PlanResolver) {
	s.planResolver = resolver
}

// Create creates a new lab in the scheduled state.
func (s *LabService) Create(creatorID uint, req CreateRequest) (Response, error) {
	return s.CreateWithOrg(creatorID, 0, req)
}

// CreateWithOrg creates a new lab scoped to an organization.
func (s *LabService) CreateWithOrg(creatorID uint, orgID uint, req CreateRequest) (Response, error) {
	// Look up template type
	labType := "network"
	if t, err := s.templateLoader.GetType(req.TemplateID); err == nil && t != "" {
		labType = t
	}

	l := &Lab{
		UUID:       uuid.New().String(),
		Name:       req.Name,
		Type:       labType,
		OrgID:      orgID,
		State:      StateScheduled,
		TemplateID: req.TemplateID,
		CreatorID:  creatorID,
	}

	if req.ScheduledStart != nil {
		t, err := time.Parse(time.RFC3339, *req.ScheduledStart)
		if err != nil {
			return Response{}, fmt.Errorf("invalid scheduledStart format: %w", err)
		}
		l.ScheduledStart = &t
	}

	if req.ScheduledEnd != nil {
		t, err := time.Parse(time.RFC3339, *req.ScheduledEnd)
		if err != nil {
			return Response{}, fmt.Errorf("invalid scheduledEnd format: %w", err)
		}
		l.ScheduledEnd = &t
	}

	if err := s.repo.Create(l); err != nil {
		return Response{}, fmt.Errorf("failed to create lab: %w", err)
	}

	return s.buildResponse(l)
}

// CheckOrgOwnership verifies that a lab belongs to the given org.
func (s *LabService) CheckOrgOwnership(labUUID string, orgID uint) error {
	l, err := s.repo.GetByUUID(labUUID)
	if err != nil {
		return fmt.Errorf("lab not found: %w", err)
	}
	if l.OrgID != orgID {
		return errors.New("lab does not belong to this organization")
	}
	return nil
}

// GetByUUID returns a lab with its nodes.
func (s *LabService) GetByUUID(uuid string) (Response, error) {
	l, err := s.repo.GetByUUID(uuid)
	if err != nil {
		return Response{}, fmt.Errorf("lab not found: %w", err)
	}
	return s.buildResponse(l)
}

// GetAll returns labs. Non-admins see only their own labs.
func (s *LabService) GetAll(userID uint, isAdmin bool) ([]Response, error) {
	var labs []Lab
	var err error

	if isAdmin {
		labs, err = s.repo.GetAll()
	} else {
		labs, err = s.repo.GetByCreatorID(userID)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to list labs: %w", err)
	}

	responses := make([]Response, 0, len(labs))
	for _, l := range labs {
		resp, err := s.buildResponse(&l)
		if err != nil {
			log.Printf("warning: failed to build lab response for %s: %v", l.UUID, err)
			continue
		}
		responses = append(responses, resp)
	}
	return responses, nil
}

// Update modifies an existing lab.
func (s *LabService) Update(uuid string, req UpdateRequest) (Response, error) {
	l, err := s.repo.GetByUUID(uuid)
	if err != nil {
		return Response{}, fmt.Errorf("lab not found: %w", err)
	}

	if req.Name != nil {
		l.Name = *req.Name
	}
	if req.ScheduledStart != nil {
		t, err := time.Parse(time.RFC3339, *req.ScheduledStart)
		if err != nil {
			return Response{}, fmt.Errorf("invalid scheduledStart format: %w", err)
		}
		l.ScheduledStart = &t
	}
	if req.ScheduledEnd != nil {
		t, err := time.Parse(time.RFC3339, *req.ScheduledEnd)
		if err != nil {
			return Response{}, fmt.Errorf("invalid scheduledEnd format: %w", err)
		}
		l.ScheduledEnd = &t
	}

	if err := s.repo.Update(l); err != nil {
		return Response{}, fmt.Errorf("failed to update lab: %w", err)
	}

	return s.buildResponse(l)
}

// Delete removes a lab. Labs that are currently running must be destroyed first.
func (s *LabService) Delete(uuid string) error {
	l, err := s.repo.GetByUUID(uuid)
	if err != nil {
		return fmt.Errorf("lab not found: %w", err)
	}

	if l.State == StateRunning || l.State == StateDeploying {
		return errors.New("cannot delete a running lab; destroy it first")
	}

	// If the lab was assigned to a worker, tell it to clean up any leftover containers
	if l.WorkerID != nil && l.ClabName != nil {
		s.cleanupWorkerContainers(l)
	}

	if err := s.repo.DeleteNodesByLabID(l.ID); err != nil {
		return fmt.Errorf("failed to delete lab nodes: %w", err)
	}

	return s.repo.Delete(l)
}

// cleanupWorkerContainers sends a best-effort destroy to the worker to remove leftover containers.
func (s *LabService) cleanupWorkerContainers(l *Lab) {
	w, err := s.workerSelector.GetWorkerByID(*l.WorkerID)
	if err != nil {
		log.Printf("cleanup: could not load worker %d for lab %s: %v", *l.WorkerID, l.UUID, err)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	req := workerclient.DestroyRequest{
		LabID:       l.UUID,
		ClabName:    *l.ClabName,
		CleanupOnly: true,
	}

	log.Printf("cleanup: sending destroy to worker %s for lab %s (clab: %s)", w.Name, l.UUID, *l.ClabName)
	if err := s.workerClient.Destroy(ctx, w.Address, w.Secret, req); err != nil {
		log.Printf("cleanup: worker destroy for lab %s failed (non-fatal): %v", l.UUID, err)
	}
}

// Deploy selects a worker, transitions the lab to deploying, and dispatches to the worker.
// nodeImages is an optional map of node name -> NOS image UUID for deploy-time overrides.
func (s *LabService) Deploy(labUUID string, nodeImages map[string]string) error {
	l, err := s.repo.GetByUUID(labUUID)
	if err != nil {
		return fmt.Errorf("lab not found: %w", err)
	}

	if l.State != StateScheduled && l.State != StateFailed && l.State != StateStopped {
		return fmt.Errorf("lab cannot be deployed from state %s", l.State)
	}

	// Plan enforcement
	orgPlan := "free"
	if s.planResolver != nil && l.OrgID > 0 {
		orgPlan = s.planResolver.GetOrgPlan(l.OrgID)
	}
	limits := plan.Get(orgPlan)

	// Check concurrent lab limit
	runningLabs, _ := s.repo.GetRunningLabsByCreator(l.CreatorID)
	if limits.MaxConcurrentLabs > 0 && len(runningLabs) >= limits.MaxConcurrentLabs {
		return fmt.Errorf("plan limit reached: %s plan allows %d concurrent lab(s)", orgPlan, limits.MaxConcurrentLabs)
	}

	w, err := s.workerSelector.SelectWorker()
	if err != nil {
		return fmt.Errorf("failed to select worker: %w", err)
	}
	if w == nil {
		return errors.New("no available workers with capacity")
	}

	// Load topology/HCL definition
	definition, err := s.templateLoader.GetDefinition(l.TemplateID)
	if err != nil {
		return fmt.Errorf("failed to load topology: %w", err)
	}

	var bindFiles map[string][]byte

	// For network labs: apply image overrides, check NOS tiers, load bind files
	if l.Type != "cloud" {
		if len(nodeImages) > 0 {
			definition, err = s.applyImageOverrides(definition, nodeImages)
			if err != nil {
				return fmt.Errorf("failed to apply image overrides: %w", err)
			}
		}

		// Check NOS tier restrictions
		if err := s.checkNosTiers(definition, orgPlan); err != nil {
			return err
		}

		nosKinds := extractNosKinds(definition)
		if len(nosKinds) > 0 {
			bindFiles, err = s.templateLoader.GetBindFilesForNos(l.TemplateID, nosKinds)
		} else {
			bindFiles, err = s.templateLoader.GetBindFiles(l.TemplateID)
		}
		if err != nil {
			return fmt.Errorf("failed to load bind files: %w", err)
		}
	}

	// Generate a unique clab name for this lab instance
	clabName := fmt.Sprintf("lab-%s", l.UUID[:8])

	l.WorkerID = &w.ID
	l.State = StateDeploying
	l.ClabName = &clabName
	now := time.Now()
	l.DeployedAt = &now
	l.ErrorMessage = nil

	if err := s.repo.Update(l); err != nil {
		return fmt.Errorf("failed to update lab state: %w", err)
	}

	s.recordEvent(l.ID, "deploy_started", fmt.Sprintf("worker: %s", w.Name))

	// Dispatch to worker asynchronously
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()

		callbackURL := s.platformURL + "/api/internal"
		req := workerclient.DeployRequest{
			LabID:       l.UUID,
			ClabName:    clabName,
			Definition:  definition,
			BindFiles:   bindFiles,
			CallbackURL: callbackURL,
			Type:        l.Type,
		}

		log.Printf("dispatching deploy to worker %s (%s) for lab %s", w.Name, w.Address, l.UUID)
		if err := s.workerClient.Deploy(ctx, w.Address, w.Secret, req); err != nil {
			log.Printf("worker deploy dispatch failed for lab %s: %v", l.UUID, err)
			errMsg := err.Error()
			_ = s.UpdateState(l.UUID, StateFailed, &errMsg)
		}
	}()

	return nil
}

// checkNosTiers verifies all nodes in a topology use NOS tiers allowed by the plan.
func (s *LabService) checkNosTiers(definition, orgPlan string) error {
	var topo map[string]interface{}
	if err := yaml.Unmarshal([]byte(definition), &topo); err != nil {
		return nil // can't parse, skip check
	}
	topoSection, ok := topo["topology"].(map[string]interface{})
	if !ok {
		return nil
	}
	nodes, ok := topoSection["nodes"].(map[string]interface{})
	if !ok {
		return nil
	}

	for nodeName, nodeRaw := range nodes {
		nodeData, ok := nodeRaw.(map[string]interface{})
		if !ok {
			continue
		}
		kind, _ := nodeData["kind"].(string)
		image, _ := nodeData["image"].(string)
		tier := plan.NosImageTier(kind, image)
		if !plan.TierAllowed(orgPlan, tier) {
			return fmt.Errorf("plan restriction: node %q uses %s NOS (requires %s plan or higher)", nodeName, tier, tierMinPlan(tier))
		}
	}
	return nil
}

func tierMinPlan(tier string) string {
	switch tier {
	case plan.TierMidweight:
		return plan.Light
	case plan.TierHeavyweight:
		return plan.Heavy
	}
	return plan.Free
}

// applyImageOverrides parses the topology YAML, overrides node images based on
// NOS image UUIDs, and returns the modified YAML string.
func (s *LabService) applyImageOverrides(definition string, nodeImages map[string]string) (string, error) {
	if s.nosImageResolver == nil {
		return "", errors.New("NOS image resolver not configured")
	}

	var topo map[string]interface{}
	if err := yaml.Unmarshal([]byte(definition), &topo); err != nil {
		return "", fmt.Errorf("failed to parse topology YAML: %w", err)
	}

	// Navigate to topology.nodes
	topoSection, ok := topo["topology"].(map[string]interface{})
	if !ok {
		return "", errors.New("topology YAML missing 'topology' section")
	}
	nodes, ok := topoSection["nodes"].(map[string]interface{})
	if !ok {
		return "", errors.New("topology YAML missing 'nodes' section")
	}

	// Track which nodes became SRL (need interface name rewriting)
	srlNodes := make(map[string]bool)

	for nodeName, imageUUID := range nodeImages {
		nodeData, ok := nodes[nodeName].(map[string]interface{})
		if !ok {
			return "", fmt.Errorf("node %q not found in topology", nodeName)
		}

		clabKind, dockerImage, err := s.nosImageResolver.ResolveImage(imageUUID)
		if err != nil {
			return "", fmt.Errorf("failed to resolve image for node %q: %w", nodeName, err)
		}

		nodeData["kind"] = clabKind
		nodeData["image"] = dockerImage

		if clabKind == "srl" {
			srlNodes[nodeName] = true
		}

		// Rewrite config delivery (startup-config / binds) for the new NOS
		nosKind := resolveNosKind(clabKind, dockerImage)
		rewriteNodeConfig(nodeData, nodeName, nosKind)
	}

	// Rewrite link interfaces for nodes that changed to SRL (ethX → e1-X)
	if len(srlNodes) > 0 {
		rewriteLinksForSRL(topoSection, srlNodes)
	}

	out, err := yaml.Marshal(topo)
	if err != nil {
		return "", fmt.Errorf("failed to marshal modified topology: %w", err)
	}
	return string(out), nil
}

// resolveNosKind maps a containerlab kind and docker image to a NOS config profile.
// Returns "" for generic nodes that don't have NOS-specific configs.
func resolveNosKind(clabKind, dockerImage string) string {
	switch clabKind {
	case "srl", "nokia_srlinux":
		return "srl"
	case "sonic-vs", "sonic-vm":
		return "sonic-vs"
	case "mikrotik_ros":
		return "mikrotik_ros"
	case "openwrt":
		return "openwrt"
	case "freebsd":
		return "freebsd"
	case "linux":
		if strings.Contains(dockerImage, "frrouting/frr") || strings.Contains(dockerImage, "mirror-frr") {
			return "frr"
		}
		if strings.Contains(dockerImage, "gobgp") || strings.Contains(dockerImage, "mirror-gobgp") {
			return "gobgp"
		}
		if strings.Contains(dockerImage, "osvbng") || strings.Contains(dockerImage, "mirror-osvbng") {
			return "osvbng"
		}
	}
	return ""
}

// rewriteLinksForSRL rewrites ethX → e1-X for nodes that were overridden to SRL kind.
func rewriteLinksForSRL(topoSection map[string]interface{}, srlNodes map[string]bool) {
	linksRaw, ok := topoSection["links"]
	if !ok {
		return
	}
	links, ok := linksRaw.([]interface{})
	if !ok {
		return
	}

	rewriteEndpoint := func(ep string) string {
		parts := strings.SplitN(ep, ":", 2)
		if len(parts) != 2 {
			return ep
		}
		nodeName, iface := parts[0], parts[1]
		if !srlNodes[nodeName] {
			return ep
		}
		// Convert ethN → e1-N
		if strings.HasPrefix(iface, "eth") {
			num := strings.TrimPrefix(iface, "eth")
			return nodeName + ":e1-" + num
		}
		return ep
	}

	for _, linkRaw := range links {
		linkMap, ok := linkRaw.(map[string]interface{})
		if !ok {
			continue
		}
		endpointsRaw, ok := linkMap["endpoints"].([]interface{})
		if !ok || len(endpointsRaw) != 2 {
			continue
		}
		for i, epRaw := range endpointsRaw {
			if ep, ok := epRaw.(string); ok {
				endpointsRaw[i] = rewriteEndpoint(ep)
			}
		}
	}
}

// extractNosKinds parses topology YAML and returns the set of NOS config profiles in use.
func extractNosKinds(definition string) []string {
	var topo map[string]interface{}
	if err := yaml.Unmarshal([]byte(definition), &topo); err != nil {
		return nil
	}
	topoSection, ok := topo["topology"].(map[string]interface{})
	if !ok {
		return nil
	}
	nodes, ok := topoSection["nodes"].(map[string]interface{})
	if !ok {
		return nil
	}

	kindSet := make(map[string]bool)
	for _, nodeRaw := range nodes {
		nodeData, ok := nodeRaw.(map[string]interface{})
		if !ok {
			continue
		}
		kind, _ := nodeData["kind"].(string)
		image, _ := nodeData["image"].(string)
		if nosKind := resolveNosKind(kind, image); nosKind != "" {
			kindSet[nosKind] = true
		}
	}

	kinds := make([]string, 0, len(kindSet))
	for k := range kindSet {
		kinds = append(kinds, k)
	}
	return kinds
}

// rewriteNodeConfig updates a node's config delivery based on the NOS kind.
// Removes old startup-config/config binds and adds the correct delivery mechanism.
func rewriteNodeConfig(nodeData map[string]interface{}, nodeName, nosKind string) {
	// Remove old startup-config
	delete(nodeData, "startup-config")

	// Remove old NOS config binds, keep non-config binds
	if bindsRaw, ok := nodeData["binds"]; ok {
		if binds, ok := bindsRaw.([]interface{}); ok {
			var kept []interface{}
			for _, b := range binds {
				bs, ok := b.(string)
				if !ok {
					kept = append(kept, b)
					continue
				}
				if !isNodeConfigBind(bs, nodeName) {
					kept = append(kept, b)
				}
			}
			if len(kept) > 0 {
				nodeData["binds"] = kept
			} else {
				delete(nodeData, "binds")
			}
		}
	}

	// Add new config delivery
	switch nosKind {
	case "srl", "nokia_srlinux":
		nodeData["startup-config"] = nodeName + ".cfg"
	case "sonic-vs", "sonic-vm":
		nodeData["startup-config"] = nodeName + ".json"
	case "mikrotik_ros":
		nodeData["startup-config"] = nodeName + ".rsc"
	case "frr":
		existing := []interface{}{}
		if bindsRaw, ok := nodeData["binds"].([]interface{}); ok {
			existing = bindsRaw
		}
		nodeData["binds"] = append(existing,
			nodeName+"-daemons:/etc/frr/daemons",
			nodeName+".conf:/etc/frr/frr.conf",
		)
	case "openwrt", "freebsd":
		nodeData["startup-config"] = nodeName + "-config.sh"
	}
}

// isNodeConfigBind returns true if the bind mount is a NOS config file for the given node.
func isNodeConfigBind(bind, nodeName string) bool {
	source := bind
	if idx := strings.Index(bind, ":"); idx >= 0 {
		source = bind[:idx]
	}
	return source == nodeName+".cfg" ||
		source == nodeName+".json" ||
		source == nodeName+".rsc" ||
		source == nodeName+"-daemons" ||
		source == nodeName+".conf" ||
		source == nodeName+"-config.sh"
}

// Destroy transitions the lab to stopping and dispatches destroy to the worker.
func (s *LabService) Destroy(labUUID string) error {
	l, err := s.repo.GetByUUID(labUUID)
	if err != nil {
		return fmt.Errorf("lab not found: %w", err)
	}

	if l.State != StateRunning && l.State != StateDeploying && l.State != StateFailed {
		return fmt.Errorf("lab cannot be destroyed from state %s", l.State)
	}

	l.State = StateStopping
	if err := s.repo.Update(l); err != nil {
		return fmt.Errorf("failed to update lab state: %w", err)
	}

	s.recordEvent(l.ID, "destroy_started", "")

	// Dispatch destroy to worker if assigned
	if l.WorkerID != nil && l.ClabName != nil {
		w, err := s.workerSelector.GetWorkerByID(*l.WorkerID)
		if err != nil {
			log.Printf("warning: could not load worker %d for destroy: %v", *l.WorkerID, err)
			_ = s.UpdateState(l.UUID, StateStopped, nil)
			return nil
		}

		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			callbackURL := s.platformURL + "/api/internal"
			req := workerclient.DestroyRequest{
				LabID:       l.UUID,
				ClabName:    *l.ClabName,
				CallbackURL: callbackURL,
				Type:        l.Type,
			}

			log.Printf("dispatching destroy to worker %s (%s) for lab %s", w.Name, w.Address, l.UUID)
			if err := s.workerClient.Destroy(ctx, w.Address, w.Secret, req); err != nil {
				log.Printf("worker destroy dispatch failed for lab %s: %v", l.UUID, err)
				errMsg := err.Error()
				_ = s.UpdateState(l.UUID, StateFailed, &errMsg)
			}
		}()
	} else {
		// No worker assigned or no clab name, just mark as stopped
		_ = s.UpdateState(l.UUID, StateStopped, nil)
	}

	return nil
}

// UpdateState is called by worker status callbacks to update lab state.
func (s *LabService) UpdateState(uuid string, state LabState, errorMsg *string) error {
	l, err := s.repo.GetByUUID(uuid)
	if err != nil {
		return fmt.Errorf("lab not found: %w", err)
	}

	oldState := l.State
	l.State = state
	l.ErrorMessage = errorMsg

	if state == StateStopped {
		now := time.Now()
		l.StoppedAt = &now
	}

	if err := s.repo.Update(l); err != nil {
		return fmt.Errorf("failed to update lab state: %w", err)
	}

	// Record event
	event := "state_changed"
	details := fmt.Sprintf("%s -> %s", oldState, state)
	if state == StateRunning {
		event = "deploy_completed"
	} else if state == StateFailed && (oldState == StateDeploying) {
		event = "deploy_failed"
		if errorMsg != nil {
			details = *errorMsg
		}
	} else if state == StateStopped {
		event = "destroy_completed"
	}
	s.recordEvent(l.ID, event, details)

	return nil
}

// UpdateNodes replaces the lab's nodes with the provided set.
func (s *LabService) UpdateNodes(uuid string, nodes []NodeResponse) error {
	l, err := s.repo.GetByUUID(uuid)
	if err != nil {
		return fmt.Errorf("lab not found: %w", err)
	}

	if err := s.repo.DeleteNodesByLabID(l.ID); err != nil {
		return fmt.Errorf("failed to clear existing nodes: %w", err)
	}

	labNodes := make([]LabNode, len(nodes))
	for i, n := range nodes {
		var propsJSON string
		if len(n.Properties) > 0 {
			if b, err := json.Marshal(n.Properties); err == nil {
				propsJSON = string(b)
			}
		}
		labNodes[i] = LabNode{
			LabID:       l.ID,
			Name:        n.Name,
			Kind:        n.Kind,
			Image:       n.Image,
			ContainerID: n.ContainerID,
			IPv4:        n.IPv4,
			IPv6:        n.IPv6,
			State:       n.State,
			Properties:  propsJSON,
		}
	}

	if err := s.repo.CreateNodes(labNodes); err != nil {
		return fmt.Errorf("failed to create nodes: %w", err)
	}

	return nil
}

// Clone creates a new lab from an existing lab's topology.
func (s *LabService) Clone(labUUID string, creatorID uint) (Response, error) {
	return s.CloneWithOrg(labUUID, creatorID, 0)
}

// CloneWithOrg creates a new lab from an existing lab's topology, scoped to an org.
func (s *LabService) CloneWithOrg(labUUID string, creatorID uint, orgID uint) (Response, error) {
	l, err := s.repo.GetByUUID(labUUID)
	if err != nil {
		return Response{}, fmt.Errorf("lab not found: %w", err)
	}

	return s.CreateWithOrg(creatorID, orgID, CreateRequest{
		Name:       l.Name + " (copy)",
		TemplateID: l.TemplateID,
	})
}

// GetAllPaginated returns paginated labs with optional state filter.
func (s *LabService) GetAllPaginated(userID uint, isAdmin bool, state string, limit, offset int) (PaginatedResponse, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	labs, total, err := s.repo.GetAllPaginated(userID, isAdmin, state, limit, offset)
	if err != nil {
		return PaginatedResponse{}, fmt.Errorf("failed to list labs: %w", err)
	}

	responses := make([]Response, 0, len(labs))
	for _, l := range labs {
		resp, err := s.buildResponse(&l)
		if err != nil {
			continue
		}
		responses = append(responses, resp)
	}

	return PaginatedResponse{
		Data:   responses,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	}, nil
}

// GetAllPaginatedByOrg returns paginated labs scoped to an organization.
func (s *LabService) GetAllPaginatedByOrg(orgID uint, state string, limit, offset int) (PaginatedResponse, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	labs, total, err := s.repo.GetAllPaginatedByOrg(orgID, state, limit, offset)
	if err != nil {
		return PaginatedResponse{}, fmt.Errorf("failed to list labs: %w", err)
	}

	responses := make([]Response, 0, len(labs))
	for _, l := range labs {
		resp, err := s.buildResponse(&l)
		if err != nil {
			continue
		}
		responses = append(responses, resp)
	}

	return PaginatedResponse{
		Data:   responses,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	}, nil
}

// GetEvents returns paginated lab events.
func (s *LabService) GetEvents(labUUID string, limit, offset int) (PaginatedResponse, error) {
	l, err := s.repo.GetByUUID(labUUID)
	if err != nil {
		return PaginatedResponse{}, fmt.Errorf("lab not found: %w", err)
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	events, total, err := s.repo.GetEventsByLabID(l.ID, limit, offset)
	if err != nil {
		return PaginatedResponse{}, err
	}

	responses := make([]LabEventResponse, len(events))
	for i, e := range events {
		responses[i] = LabEventResponse{
			Event:     e.Event,
			Details:   e.Details,
			CreatedAt: e.CreatedAt,
		}
	}

	return PaginatedResponse{
		Data:   responses,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	}, nil
}

// Capture runs tcpdump on a container interface via the worker (host-side, containerlab-native).
func (s *LabService) Capture(labUUID, nodeName, iface string, count int, filter string) (string, error) {
	l, err := s.repo.GetByUUID(labUUID)
	if err != nil {
		return "", fmt.Errorf("lab not found: %w", err)
	}

	if l.State != StateRunning {
		return "", fmt.Errorf("lab must be running for capture (current: %s)", l.State)
	}

	if l.WorkerID == nil {
		return "", fmt.Errorf("lab has no worker assigned")
	}

	w, err := s.workerSelector.GetWorkerByID(*l.WorkerID)
	if err != nil {
		return "", fmt.Errorf("worker not found: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	resp, err := s.workerClient.Capture(ctx, w.Address, w.Secret, workerclient.CaptureRequest{
		NodeName:  nodeName,
		Interface: iface,
		Count:     count,
		Filter:    filter,
	})
	if err != nil {
		return "", err
	}

	return resp.Output, nil
}

// AwsExec proxies an AWS CLI command to the worker running this cloud lab.
func (s *LabService) AwsExec(labUUID, command string) (string, error) {
	l, err := s.repo.GetByUUID(labUUID)
	if err != nil {
		return "", fmt.Errorf("lab not found: %w", err)
	}

	if l.Type != "cloud" {
		return "", fmt.Errorf("aws-exec is only available for cloud labs")
	}

	if l.State != StateRunning {
		return "", fmt.Errorf("lab must be running for aws-exec (current: %s)", l.State)
	}

	if l.WorkerID == nil {
		return "", fmt.Errorf("lab has no worker assigned")
	}

	w, err := s.workerSelector.GetWorkerByID(*l.WorkerID)
	if err != nil {
		return "", fmt.Errorf("worker not found: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	resp, err := s.workerClient.AwsExec(ctx, w.Address, w.Secret, workerclient.AwsExecRequest{
		LabID:   l.UUID,
		Command: command,
	})
	if err != nil {
		return "", err
	}

	return resp.Output, nil
}

// PauseAllLabs destroys all running/deploying labs for a given user.
func (s *LabService) PauseAllLabs(creatorID uint) (int, error) {
	labs, err := s.repo.GetRunningLabsByCreator(creatorID)
	if err != nil {
		return 0, fmt.Errorf("failed to query running labs: %w", err)
	}

	count := 0
	for _, l := range labs {
		if err := s.Destroy(l.UUID); err != nil {
			log.Printf("pause-all: failed to destroy lab %s: %v", l.UUID, err)
			continue
		}
		count++
	}
	return count, nil
}

// CleanupStuckLabs marks labs stuck in transitional states as failed/stopped
// and tells workers to clean up any leftover containers.
func (s *LabService) CleanupStuckLabs(threshold time.Duration) {
	labs, err := s.repo.GetStuckLabs(threshold)
	if err != nil {
		log.Printf("cleanup: failed to query stuck labs: %v", err)
		return
	}

	for _, l := range labs {
		// Tell the worker to destroy leftover containers
		if l.WorkerID != nil && l.ClabName != nil {
			s.cleanupWorkerContainers(&l)
		}

		if l.State == StateStopping {
			log.Printf("cleanup: marking stuck lab %s as stopped", l.UUID)
			_ = s.UpdateState(l.UUID, StateStopped, nil)
		} else {
			log.Printf("cleanup: marking stuck lab %s as failed", l.UUID)
			msg := "Operation timed out — worker may have failed. Please retry."
			_ = s.UpdateState(l.UUID, StateFailed, &msg)
		}
	}
}

func (s *LabService) recordEvent(labID uint, event, details string) {
	_ = s.repo.CreateEvent(&LabEvent{
		LabID:   labID,
		Event:   event,
		Details: details,
	})
}

// buildResponse converts a Lab entity to a Response DTO, including nodes.
func (s *LabService) buildResponse(l *Lab) (Response, error) {
	nodes, err := s.repo.GetNodesByLabID(l.ID)
	if err != nil {
		return Response{}, fmt.Errorf("failed to load lab nodes: %w", err)
	}

	nodeResponses := make([]NodeResponse, len(nodes))
	for i, n := range nodes {
		nodeResponses[i] = NodeResponse{
			Name:        n.Name,
			Kind:        n.Kind,
			Image:       n.Image,
			ContainerID: n.ContainerID,
			IPv4:        n.IPv4,
			IPv6:        n.IPv6,
			State:       n.State,
		}
		if n.Properties != "" {
			var props map[string]string
			if err := json.Unmarshal([]byte(n.Properties), &props); err == nil {
				nodeResponses[i].Properties = props
			}
		}
	}

	return Response{
		UUID:           l.UUID,
		Name:           l.Name,
		Type:           l.Type,
		State:          l.State,
		TemplateID:     l.TemplateID,
		CreatorID:      l.CreatorID,
		Nodes:          nodeResponses,
		ScheduledStart: l.ScheduledStart,
		ScheduledEnd:   l.ScheduledEnd,
		DeployedAt:     l.DeployedAt,
		StoppedAt:      l.StoppedAt,
		ErrorMessage:   l.ErrorMessage,
		CreatedAt:      l.CreatedAt,
	}, nil
}
