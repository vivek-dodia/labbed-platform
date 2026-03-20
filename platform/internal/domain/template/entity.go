package template

import (
	"time"

	"gorm.io/gorm"
)

type Template struct {
	gorm.Model
	UUID         string `gorm:"uniqueIndex;not null"`
	Name         string `gorm:"index;not null"`
	Type         string `gorm:"index;not null;default:'network'"` // "network" | "cloud"
	Definition   string `gorm:"type:text;not null"`               // YAML (network) or HCL (cloud)
	OrgID        uint   `gorm:"index;not null;default:0"`
	CollectionID uint   `gorm:"index;not null"`
	CreatorID    uint   `gorm:"not null"`
}

type BindFile struct {
	gorm.Model
	UUID       string `gorm:"uniqueIndex;not null"`
	TemplateID uint   `gorm:"index;not null"`
	FilePath   string `gorm:"not null"`
	Content    []byte `gorm:"not null"`
	NosKind    string `gorm:"default:''"` // "" = universal, "mikrotik_ros", "frr", "openwrt", "freebsd"
}

// --- DTOs ---

type CreateRequest struct {
	Name         string `json:"name" binding:"required"`
	Type         string `json:"type"`                          // "network" (default) | "cloud"
	Definition   string `json:"definition" binding:"required"` // YAML or HCL
	CollectionID string `json:"collectionId" binding:"required"`
}

type UpdateRequest struct {
	Name       *string `json:"name"`
	Definition *string `json:"definition"`
}

type CreateBindFileRequest struct {
	FilePath string `json:"filePath" binding:"required"`
	Content  string `json:"content" binding:"required"` // base64 or plain text
	NosKind  string `json:"nosKind"`
}

type UpdateBindFileRequest struct {
	FilePath *string `json:"filePath"`
	Content  *string `json:"content"`
	NosKind  *string `json:"nosKind"`
}

type BindFileResponse struct {
	UUID      string    `json:"uuid"`
	FilePath  string    `json:"filePath"`
	Content   string    `json:"content"`
	NosKind   string    `json:"nosKind"`
	CreatedAt time.Time `json:"createdAt"`
}

type Response struct {
	UUID         string             `json:"uuid"`
	Name         string             `json:"name"`
	Type         string             `json:"type"`
	Definition   string             `json:"definition"`
	CollectionID string             `json:"collectionId"`
	CreatorID    string             `json:"creatorId"`
	BindFiles    []BindFileResponse `json:"bindFiles"`
	CreatedAt    time.Time          `json:"createdAt"`
	UpdatedAt    time.Time          `json:"updatedAt"`
}
