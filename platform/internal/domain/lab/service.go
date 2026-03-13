package lab

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/labbed/platform/internal/domain/worker"
	"github.com/labbed/platform/internal/workerclient"
)

// WorkerSelector is a minimal interface for worker selection, keeping the lab
// service decoupled from the full worker service for testability.
type WorkerSelector interface {
	SelectWorker() (*worker.Worker, error)
	GetWorkerByID(id uint) (*worker.Worker, error)
}

// TopologyLoader loads topology definitions and bind files for deploy dispatch.
type TopologyLoader interface {
	GetDefinition(topoUUID string) (string, error)                      // returns YAML definition
	GetBindFiles(topoUUID string) (map[string][]byte, error)            // filePath -> content
}

type LabService struct {
	repo           *LabRepository
	workerSelector WorkerSelector
	workerClient   *workerclient.Client
	topoLoader     TopologyLoader
	platformURL    string // base URL for worker callbacks
}

func NewService(repo *LabRepository, workerSelector WorkerSelector, wc *workerclient.Client, tl TopologyLoader, platformURL string) *LabService {
	return &LabService{
		repo:           repo,
		workerSelector: workerSelector,
		workerClient:   wc,
		topoLoader:     tl,
		platformURL:    platformURL,
	}
}

// Create creates a new lab in the scheduled state.
func (s *LabService) Create(creatorID uint, req CreateRequest) (Response, error) {
	return s.CreateWithOrg(creatorID, 0, req)
}

// CreateWithOrg creates a new lab scoped to an organization.
func (s *LabService) CreateWithOrg(creatorID uint, orgID uint, req CreateRequest) (Response, error) {
	l := &Lab{
		UUID:       uuid.New().String(),
		Name:       req.Name,
		OrgID:      orgID,
		State:      StateScheduled,
		TopologyID: req.TopologyID,
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
func (s *LabService) Deploy(labUUID string) error {
	l, err := s.repo.GetByUUID(labUUID)
	if err != nil {
		return fmt.Errorf("lab not found: %w", err)
	}

	if l.State != StateScheduled && l.State != StateFailed && l.State != StateStopped {
		return fmt.Errorf("lab cannot be deployed from state %s", l.State)
	}

	w, err := s.workerSelector.SelectWorker()
	if err != nil {
		return fmt.Errorf("failed to select worker: %w", err)
	}
	if w == nil {
		return errors.New("no available workers with capacity")
	}

	// Load topology definition and bind files
	definition, err := s.topoLoader.GetDefinition(l.TopologyID)
	if err != nil {
		return fmt.Errorf("failed to load topology: %w", err)
	}

	bindFiles, err := s.topoLoader.GetBindFiles(l.TopologyID)
	if err != nil {
		return fmt.Errorf("failed to load bind files: %w", err)
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
			Topology:    definition,
			BindFiles:   bindFiles,
			CallbackURL: callbackURL,
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
		labNodes[i] = LabNode{
			LabID:       l.ID,
			Name:        n.Name,
			Kind:        n.Kind,
			Image:       n.Image,
			ContainerID: n.ContainerID,
			IPv4:        n.IPv4,
			IPv6:        n.IPv6,
			State:       n.State,
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
		TopologyID: l.TopologyID,
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
	}

	return Response{
		UUID:           l.UUID,
		Name:           l.Name,
		State:          l.State,
		TopologyID:     l.TopologyID,
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
