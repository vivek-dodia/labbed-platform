package guide

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/labbed/platform/internal/domain/lab"
	"github.com/labbed/platform/internal/domain/worker"
	"github.com/labbed/platform/internal/workerclient"
)

// Service handles guide business logic.
type Service struct {
	repo          *Repository
	getTemplate   func(uuid string) (templateID uint, err error)
	getLabByUUID  func(uuid string) (*lab.Response, error)
	getLabEntity  func(uuid string) (*lab.Lab, error)
	getWorker     func(id uint) (*worker.Worker, error)
	workerClient  *workerclient.Client
	resolveUserID func(uuid string) (uint, error)
}

// NewService creates a new guide service.
func NewService(
	repo *Repository,
	getTemplate func(uuid string) (uint, error),
	getLabByUUID func(uuid string) (*lab.Response, error),
	getLabEntity func(uuid string) (*lab.Lab, error),
	getWorker func(id uint) (*worker.Worker, error),
	workerClient *workerclient.Client,
	resolveUserID func(uuid string) (uint, error),
) *Service {
	return &Service{
		repo:          repo,
		getTemplate:   getTemplate,
		getLabByUUID:  getLabByUUID,
		getLabEntity:  getLabEntity,
		getWorker:     getWorker,
		workerClient:  workerClient,
		resolveUserID: resolveUserID,
	}
}

// GetGuideForTemplate returns the guide for a template, or nil if none exists.
func (s *Service) GetGuideForTemplate(templateUUID string) (*GuideResponse, error) {
	templateID, err := s.getTemplate(templateUUID)
	if err != nil {
		return nil, fmt.Errorf("template not found: %w", err)
	}

	g, err := s.repo.GetByTemplateID(templateID)
	if err != nil {
		return nil, err
	}

	return buildGuideResponse(g, templateUUID)
}

// GetProgress returns the user's completed steps for a template's guide.
func (s *Service) GetProgress(userUUID, templateUUID string) (*ProgressResponse, error) {
	userID, err := s.resolveUserID(userUUID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	templateID, err := s.getTemplate(templateUUID)
	if err != nil {
		return nil, fmt.Errorf("template not found: %w", err)
	}

	g, err := s.repo.GetByTemplateID(templateID)
	if err != nil {
		return nil, err
	}

	var steps []GuideStep
	json.Unmarshal([]byte(g.Steps), &steps)

	progress, err := s.repo.GetProgress(userID, templateID)
	if err != nil {
		return nil, err
	}

	completed := make([]int, 0, len(progress))
	for _, p := range progress {
		completed = append(completed, p.StepIndex)
	}

	return &ProgressResponse{
		CompletedSteps: completed,
		TotalSteps:     len(steps),
	}, nil
}

// ValidateStep executes the validation check for a guide step against a running lab.
func (s *Service) ValidateStep(labUUID, userUUID string, stepIndex int) (*ValidationResult, error) {
	// Get the lab and its template
	labResp, err := s.getLabByUUID(labUUID)
	if err != nil {
		return nil, fmt.Errorf("lab not found: %w", err)
	}

	templateID, err := s.getTemplate(labResp.TemplateID)
	if err != nil {
		return nil, fmt.Errorf("template not found: %w", err)
	}

	// Get the guide
	g, err := s.repo.GetByTemplateID(templateID)
	if err != nil {
		return nil, fmt.Errorf("no guide for this template: %w", err)
	}

	var steps []GuideStep
	if err := json.Unmarshal([]byte(g.Steps), &steps); err != nil {
		return nil, fmt.Errorf("invalid guide steps: %w", err)
	}

	if stepIndex < 0 || stepIndex >= len(steps) {
		return nil, fmt.Errorf("step index %d out of range (0-%d)", stepIndex, len(steps)-1)
	}

	step := steps[stepIndex]

	// If no validation, auto-pass
	if step.Validation == nil {
		userID, _ := s.resolveUserID(userUUID)
		if userID > 0 {
			s.repo.MarkStepComplete(userID, templateID, stepIndex)
		}
		return &ValidationResult{Passed: true, StepIndex: stepIndex, Output: "No validation required — step marked complete."}, nil
	}

	// Resolve the node
	labEntity, err := s.getLabEntity(labUUID)
	if err != nil || labEntity.WorkerID == nil {
		return nil, fmt.Errorf("lab has no worker assigned")
	}

	w, err := s.getWorker(*labEntity.WorkerID)
	if err != nil {
		return nil, fmt.Errorf("worker not found: %w", err)
	}

	// Find the node and determine its kind
	containerName := step.Validation.Node
	nodeKind := ""
	for _, n := range labResp.Nodes {
		if n.Name == step.Validation.Node || strings.HasSuffix(n.Name, "-"+step.Validation.Node) {
			containerName = n.Name
			nodeKind = n.Kind
			break
		}
	}

	// Pick the right command/pattern for the NOS
	cmd := step.Validation.Command
	pattern := step.Validation.Pattern
	if step.Validation.NosVariants != nil {
		if variant, ok := step.Validation.NosVariants[nodeKind]; ok {
			if variant.Command != "" {
				cmd = variant.Command
			}
			if variant.Pattern != "" {
				pattern = variant.Pattern
			}
		}
	}

	// Execute the command
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	resp, err := s.workerClient.Exec(ctx, w.Address, w.Secret, workerclient.ExecRequest{
		LabID:    labUUID,
		NodeName: containerName,
		Command:  cmd,
		NodeKind: nodeKind,
	})
	if err != nil {
		return &ValidationResult{Passed: false, StepIndex: stepIndex, Output: "Exec failed: " + err.Error()}, nil
	}

	// Check output against pattern
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, fmt.Errorf("invalid validation pattern %q: %w", pattern, err)
	}

	passed := re.MatchString(resp.Output)

	// Mark complete if passed
	if passed {
		userID, _ := s.resolveUserID(userUUID)
		if userID > 0 {
			s.repo.MarkStepComplete(userID, templateID, stepIndex)
		}
	}

	return &ValidationResult{
		Passed:    passed,
		StepIndex: stepIndex,
		Output:    resp.Output,
	}, nil
}

// MarkStepComplete manually marks a step as complete (for steps without validation).
func (s *Service) MarkStepComplete(userUUID, templateUUID string, stepIndex int) error {
	userID, err := s.resolveUserID(userUUID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}
	templateID, err := s.getTemplate(templateUUID)
	if err != nil {
		return fmt.Errorf("template not found: %w", err)
	}
	return s.repo.MarkStepComplete(userID, templateID, stepIndex)
}

// ResetProgress clears all progress for a user on a template's guide.
func (s *Service) ResetProgress(userUUID, templateUUID string) error {
	userID, err := s.resolveUserID(userUUID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}
	templateID, err := s.getTemplate(templateUUID)
	if err != nil {
		return fmt.Errorf("template not found: %w", err)
	}
	return s.repo.ResetProgress(userID, templateID)
}

func buildGuideResponse(g *LabGuide, templateUUID string) (*GuideResponse, error) {
	var steps []GuideStep
	if err := json.Unmarshal([]byte(g.Steps), &steps); err != nil {
		return nil, fmt.Errorf("invalid guide steps JSON: %w", err)
	}

	var concepts []string
	json.Unmarshal([]byte(g.Concepts), &concepts)

	return &GuideResponse{
		UUID:          g.UUID,
		TemplateID:    templateUUID,
		Title:         g.Title,
		Description:   g.Description,
		Difficulty:    g.Difficulty,
		Concepts:      concepts,
		TopologyNotes: g.TopologyNotes,
		EstimatedTime: g.EstimatedTime,
		Steps:         steps,
		CreatedAt:     g.CreatedAt,
	}, nil
}
