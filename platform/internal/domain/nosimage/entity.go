package nosimage

import (
	"time"

	"gorm.io/gorm"
)

type NosImage struct {
	gorm.Model
	UUID        string `gorm:"uniqueIndex;not null"`
	Name        string `gorm:"not null"`
	ClabKind    string `gorm:"not null"` // "linux", "mikrotik_ros"
	DockerImage string `gorm:"not null"` // "quay.io/frrouting/frr:10.3.1"
	DefaultUser string
	DefaultPass string
	IsSystem    bool `gorm:"not null;default:false"`
	OrgID       uint `gorm:"index;not null;default:0"` // 0 = global/system
}

// --- DTOs ---

type CreateRequest struct {
	Name        string `json:"name" binding:"required"`
	ClabKind    string `json:"clabKind" binding:"required"`
	DockerImage string `json:"dockerImage" binding:"required"`
	DefaultUser string `json:"defaultUser"`
	DefaultPass string `json:"defaultPass"`
}

type Response struct {
	UUID        string    `json:"uuid"`
	Name        string    `json:"name"`
	ClabKind    string    `json:"clabKind"`
	DockerImage string    `json:"dockerImage"`
	DefaultUser string    `json:"defaultUser"`
	DefaultPass string    `json:"defaultPass"`
	IsSystem    bool      `json:"isSystem"`
	CreatedAt   time.Time `json:"createdAt"`
}

func (n *NosImage) ToResponse() Response {
	return Response{
		UUID:        n.UUID,
		Name:        n.Name,
		ClabKind:    n.ClabKind,
		DockerImage: n.DockerImage,
		DefaultUser: n.DefaultUser,
		DefaultPass: n.DefaultPass,
		IsSystem:    n.IsSystem,
		CreatedAt:   n.CreatedAt,
	}
}
