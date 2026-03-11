package lab

import (
	"time"

	"gorm.io/gorm"
)

type LabState string

const (
	StateScheduled LabState = "scheduled"
	StateDeploying LabState = "deploying"
	StateRunning   LabState = "running"
	StateStopping  LabState = "stopping"
	StateFailed    LabState = "failed"
	StateStopped   LabState = "stopped"
)

type Lab struct {
	gorm.Model
	UUID           string     `gorm:"uniqueIndex;not null"`
	Name           string     `gorm:"index;not null"`
	OrgID          uint       `gorm:"index;not null;default:0"`
	State          LabState   `gorm:"not null;default:'scheduled'"`
	TopologyID     string     `gorm:"index;not null"` // topology UUID
	CreatorID      uint       `gorm:"not null"`
	WorkerID       *uint      `gorm:"index"`
	ScheduledStart *time.Time `gorm:"index"`
	ScheduledEnd   *time.Time
	DeployedAt     *time.Time
	StoppedAt      *time.Time
	ErrorMessage   *string
	ClabName       *string `gorm:"index"` // containerlab instance name on worker
}

type LabNode struct {
	gorm.Model
	LabID       uint   `gorm:"index;not null"`
	Name        string `gorm:"not null"`
	Kind        string
	Image       string
	ContainerID string
	IPv4        string
	IPv6        string
	State       string // running, exited, starting
}

// LabEvent tracks state transitions and deployment milestones.
type LabEvent struct {
	gorm.Model
	LabID   uint   `gorm:"index;not null"`
	Event   string `gorm:"not null"` // created, deploy_started, deploy_completed, deploy_failed, destroy_started, destroy_completed, state_changed, log
	Details string
}

// --- DTOs ---

type CreateRequest struct {
	Name           string  `json:"name" binding:"required"`
	TopologyID     string  `json:"topologyId" binding:"required"`
	ScheduledStart *string `json:"scheduledStart"` // RFC3339
	ScheduledEnd   *string `json:"scheduledEnd"`   // RFC3339
}

type UpdateRequest struct {
	Name           *string `json:"name"`
	ScheduledStart *string `json:"scheduledStart"`
	ScheduledEnd   *string `json:"scheduledEnd"`
}

type NodeResponse struct {
	Name        string `json:"name"`
	Kind        string `json:"kind"`
	Image       string `json:"image"`
	ContainerID string `json:"containerId"`
	IPv4        string `json:"ipv4"`
	IPv6        string `json:"ipv6"`
	State       string `json:"state"`
}

type Response struct {
	UUID           string         `json:"uuid"`
	Name           string         `json:"name"`
	State          LabState       `json:"state"`
	TopologyID     string         `json:"topologyId"`
	CreatorID      uint           `json:"creatorId"`
	Nodes          []NodeResponse `json:"nodes"`
	ScheduledStart *time.Time     `json:"scheduledStart"`
	ScheduledEnd   *time.Time     `json:"scheduledEnd"`
	DeployedAt     *time.Time     `json:"deployedAt"`
	StoppedAt      *time.Time     `json:"stoppedAt"`
	ErrorMessage   *string        `json:"errorMessage"`
	CreatedAt      time.Time      `json:"createdAt"`
}

type LabEventResponse struct {
	Event     string    `json:"event"`
	Details   string    `json:"details"`
	CreatedAt time.Time `json:"createdAt"`
}

// LogPushRequest is sent by workers to stream deployment logs.
type LogPushRequest struct {
	LabUUID string `json:"labUuid" binding:"required"`
	Line    string `json:"line" binding:"required"`
	Level   string `json:"level"` // info, warn, error
}

// PaginatedResponse wraps a list response with pagination metadata.
type PaginatedResponse struct {
	Data   interface{} `json:"data"`
	Total  int64       `json:"total"`
	Limit  int         `json:"limit"`
	Offset int         `json:"offset"`
}
