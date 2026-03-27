package guide

import (
	"time"

	"gorm.io/gorm"
)

// LabGuide stores the learning guide for a template.
type LabGuide struct {
	gorm.Model
	UUID           string `gorm:"uniqueIndex;not null"`
	TemplateID     uint   `gorm:"uniqueIndex;not null"` // one guide per template
	Title          string `gorm:"not null"`
	Description    string `gorm:"type:text"`
	Difficulty     string `gorm:"default:'beginner'"` // beginner, intermediate, advanced
	Concepts       string `gorm:"type:text"`          // JSON array of strings
	TopologyNotes  string `gorm:"type:text"`          // markdown
	EstimatedTime  string // e.g. "15 min"
	Steps          string `gorm:"type:text"` // JSON array of GuideStep
}

// GuideProgress tracks a user's completed steps for a template's guide.
type GuideProgress struct {
	gorm.Model
	UserID      uint      `gorm:"index;not null"`
	TemplateID  uint      `gorm:"index;not null"`
	StepIndex   int       `gorm:"not null"`
	CompletedAt time.Time `gorm:"not null"`
}

// --- In-memory structs (not DB models, for JSON serialization) ---

type GuideStep struct {
	Title       string          `json:"title"`
	Description string          `json:"description"`
	Hint        string          `json:"hint,omitempty"`
	Validation  *StepValidation `json:"validation,omitempty"`
}

type StepValidation struct {
	Node        string                `json:"node"`              // short node name from YAML
	Command     string                `json:"command"`           // default command
	Pattern     string                `json:"pattern"`           // regex to match in output
	NosVariants map[string]NosVariant `json:"nosVariants,omitempty"` // per-NOS overrides
}

type NosVariant struct {
	Command string `json:"command"`
	Pattern string `json:"pattern"`
}

// --- DTOs ---

type GuideResponse struct {
	UUID          string         `json:"uuid"`
	TemplateID    string         `json:"templateId"`
	Title         string         `json:"title"`
	Description   string         `json:"description"`
	Difficulty    string         `json:"difficulty"`
	Concepts      []string       `json:"concepts"`
	TopologyNotes string         `json:"topologyNotes"`
	EstimatedTime string         `json:"estimatedTime"`
	Steps         []GuideStep    `json:"steps"`
	CreatedAt     time.Time      `json:"createdAt"`
}

type ProgressResponse struct {
	CompletedSteps []int `json:"completedSteps"`
	TotalSteps     int   `json:"totalSteps"`
}

type ValidateStepRequest struct {
	StepIndex int `json:"stepIndex" binding:"required"`
}

type ValidationResult struct {
	Passed    bool   `json:"passed"`
	Output    string `json:"output"`
	StepIndex int    `json:"stepIndex"`
}
