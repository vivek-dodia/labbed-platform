package worker

import (
	"time"

	"gorm.io/gorm"
)

type WorkerState string

const (
	StateOnline   WorkerState = "online"
	StateOffline  WorkerState = "offline"
	StateDraining WorkerState = "draining"
)

type Worker struct {
	gorm.Model
	UUID          string      `gorm:"uniqueIndex;not null"`
	Name          string      `gorm:"uniqueIndex:idx_worker_org_name;not null"`
	OrgID         uint        `gorm:"uniqueIndex:idx_worker_org_name;index;not null;default:0"`
	Address       string      `gorm:"not null"` // base URL, e.g. http://10.0.0.5:8081
	Secret        string      `gorm:"not null"` // shared secret for auth
	State         WorkerState `gorm:"not null;default:'offline'"`
	LastHeartbeat *time.Time
	Capacity      int `gorm:"default:0"` // max concurrent labs, 0 = unlimited
	ActiveLabs    int `gorm:"default:0"`
}

// --- DTOs ---

type RegisterRequest struct {
	Name    string `json:"name" binding:"required"`
	Address string `json:"address" binding:"required"`
	Secret  string `json:"secret" binding:"required"`
}

type RegisterResponse struct {
	UUID   string `json:"uuid"`
	Secret string `json:"secret"` // platform's secret for worker to verify callbacks
}

type HeartbeatRequest struct {
	WorkerID   string `json:"workerId" binding:"required"`
	ActiveLabs int    `json:"activeLabs"`
}

type CreateRequest struct {
	Name     string `json:"name" binding:"required"`
	Address  string `json:"address" binding:"required"`
	Capacity int    `json:"capacity"`
}

type UpdateRequest struct {
	Name     *string      `json:"name"`
	Address  *string      `json:"address"`
	State    *WorkerState `json:"state"`
	Capacity *int         `json:"capacity"`
}

type Response struct {
	UUID          string      `json:"uuid"`
	Name          string      `json:"name"`
	Address       string      `json:"address"`
	State         WorkerState `json:"state"`
	LastHeartbeat *time.Time  `json:"lastHeartbeat"`
	Capacity      int         `json:"capacity"`
	ActiveLabs    int         `json:"activeLabs"`
	CreatedAt     time.Time   `json:"createdAt"`
}

func (w *Worker) ToResponse() Response {
	return Response{
		UUID:          w.UUID,
		Name:          w.Name,
		Address:       w.Address,
		State:         w.State,
		LastHeartbeat: w.LastHeartbeat,
		Capacity:      w.Capacity,
		ActiveLabs:    w.ActiveLabs,
		CreatedAt:     w.CreatedAt,
	}
}
