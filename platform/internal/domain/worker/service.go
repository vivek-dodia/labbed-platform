package worker

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type WorkerService struct {
	repo *WorkerRepository
}

func NewService(repo *WorkerRepository) *WorkerService {
	return &WorkerService{repo: repo}
}

// Register handles worker self-registration. It upserts by name: if a worker with
// the given name already exists, it updates the address and secret; otherwise it
// creates a new worker with a generated UUID and platform secret.
func (s *WorkerService) Register(req RegisterRequest) (RegisterResponse, error) {
	existing, err := s.repo.GetByName(req.Name)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return RegisterResponse{}, fmt.Errorf("failed to look up worker: %w", err)
	}

	platformSecret, err := generateSecret()
	if err != nil {
		return RegisterResponse{}, fmt.Errorf("failed to generate platform secret: %w", err)
	}

	if existing != nil {
		existing.Address = req.Address
		existing.Secret = req.Secret
		existing.State = StateOnline
		now := time.Now()
		existing.LastHeartbeat = &now
		if err := s.repo.Update(existing); err != nil {
			return RegisterResponse{}, fmt.Errorf("failed to update worker: %w", err)
		}
		return RegisterResponse{
			UUID:   existing.UUID,
			Secret: platformSecret,
		}, nil
	}

	w := &Worker{
		UUID:    uuid.New().String(),
		Name:    req.Name,
		Address: req.Address,
		Secret:  req.Secret,
		State:   StateOnline,
	}
	now := time.Now()
	w.LastHeartbeat = &now

	if err := s.repo.Create(w); err != nil {
		return RegisterResponse{}, fmt.Errorf("failed to create worker: %w", err)
	}

	return RegisterResponse{
		UUID:   w.UUID,
		Secret: platformSecret,
	}, nil
}

// Heartbeat processes a heartbeat from a worker.
func (s *WorkerService) Heartbeat(req HeartbeatRequest) error {
	return s.repo.UpdateHeartbeat(req.WorkerID, req.ActiveLabs)
}

// GetAll returns all workers as response DTOs.
func (s *WorkerService) GetAll() ([]Response, error) {
	workers, err := s.repo.GetAll()
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve workers: %w", err)
	}

	responses := make([]Response, len(workers))
	for i, w := range workers {
		responses[i] = w.ToResponse()
	}
	return responses, nil
}

// GetAllByOrg returns workers scoped to an organization.
func (s *WorkerService) GetAllByOrg(orgID uint) ([]Response, error) {
	workers, err := s.repo.GetAllByOrgID(orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve workers: %w", err)
	}

	responses := make([]Response, len(workers))
	for i, w := range workers {
		responses[i] = w.ToResponse()
	}
	return responses, nil
}

// CheckOrgOwnership verifies that a worker belongs to the given org.
func (s *WorkerService) CheckOrgOwnership(workerUUID string, orgID uint) error {
	w, err := s.repo.GetByUUID(workerUUID)
	if err != nil {
		return fmt.Errorf("worker not found: %w", err)
	}
	if w.OrgID != orgID {
		return errors.New("worker does not belong to this organization")
	}
	return nil
}

// GetByUUID returns a single worker by UUID.
func (s *WorkerService) GetByUUID(uuid string) (Response, error) {
	w, err := s.repo.GetByUUID(uuid)
	if err != nil {
		return Response{}, fmt.Errorf("worker not found: %w", err)
	}
	return w.ToResponse(), nil
}

// Create pre-registers a worker (admin action).
func (s *WorkerService) Create(req CreateRequest) (Response, error) {
	return s.CreateWithOrg(req, 0)
}

// CreateWithOrg pre-registers a worker scoped to an organization.
func (s *WorkerService) CreateWithOrg(req CreateRequest, orgID uint) (Response, error) {
	secret, err := generateSecret()
	if err != nil {
		return Response{}, fmt.Errorf("failed to generate secret: %w", err)
	}

	w := &Worker{
		UUID:     uuid.New().String(),
		Name:     req.Name,
		OrgID:    orgID,
		Address:  req.Address,
		Secret:   secret,
		State:    StateOffline,
		Capacity: req.Capacity,
	}

	if err := s.repo.Create(w); err != nil {
		return Response{}, fmt.Errorf("failed to create worker: %w", err)
	}

	return w.ToResponse(), nil
}

// Update modifies an existing worker.
func (s *WorkerService) Update(workerUUID string, req UpdateRequest) (Response, error) {
	w, err := s.repo.GetByUUID(workerUUID)
	if err != nil {
		return Response{}, fmt.Errorf("worker not found: %w", err)
	}

	if req.Name != nil {
		w.Name = *req.Name
	}
	if req.Address != nil {
		w.Address = *req.Address
	}
	if req.State != nil {
		w.State = *req.State
	}
	if req.Capacity != nil {
		w.Capacity = *req.Capacity
	}

	if err := s.repo.Update(w); err != nil {
		return Response{}, fmt.Errorf("failed to update worker: %w", err)
	}

	return w.ToResponse(), nil
}

// Delete removes a worker by UUID.
func (s *WorkerService) Delete(workerUUID string) error {
	w, err := s.repo.GetByUUID(workerUUID)
	if err != nil {
		return fmt.Errorf("worker not found: %w", err)
	}
	return s.repo.Delete(w)
}

// GetWorkerByID returns the raw Worker entity by primary key.
func (s *WorkerService) GetWorkerByID(id uint) (*Worker, error) {
	return s.repo.GetByID(id)
}

// SelectWorker picks the least loaded online worker that has capacity.
// Returns nil if no suitable worker is available.
func (s *WorkerService) SelectWorker() (*Worker, error) {
	workers, err := s.repo.GetAvailable()
	if err != nil {
		return nil, fmt.Errorf("failed to query available workers: %w", err)
	}

	for _, w := range workers {
		if w.Capacity == 0 || w.ActiveLabs < w.Capacity {
			return &w, nil
		}
	}

	return nil, nil
}

// MarkStaleWorkers sets workers to offline if their last heartbeat exceeds the timeout.
func (s *WorkerService) MarkStaleWorkers(timeout time.Duration) {
	workers, err := s.repo.GetAll()
	if err != nil {
		return
	}

	cutoff := time.Now().Add(-timeout)
	for _, w := range workers {
		if w.State == StateOnline && (w.LastHeartbeat == nil || w.LastHeartbeat.Before(cutoff)) {
			w.State = StateOffline
			_ = s.repo.Update(&w)
		}
	}
}

func generateSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
