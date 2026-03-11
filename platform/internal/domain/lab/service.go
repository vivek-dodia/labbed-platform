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
	l := &Lab{
		UUID:       uuid.New().String(),
		Name:       req.Name,
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

	if err := s.repo.DeleteNodesByLabID(l.ID); err != nil {
		return fmt.Errorf("failed to delete lab nodes: %w", err)
	}

	return s.repo.Delete(l)
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

	l.State = state
	l.ErrorMessage = errorMsg

	if state == StateStopped {
		now := time.Now()
		l.StoppedAt = &now
	}

	if err := s.repo.Update(l); err != nil {
		return fmt.Errorf("failed to update lab state: %w", err)
	}

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
