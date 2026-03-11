package topology

import (
	"time"

	"gorm.io/gorm"
)

type Topology struct {
	gorm.Model
	UUID         string `gorm:"uniqueIndex;not null"`
	Name         string `gorm:"index;not null"`
	Definition   string `gorm:"type:text;not null"` // YAML content
	CollectionID uint   `gorm:"index;not null"`
	CreatorID    uint   `gorm:"not null"`
}

type BindFile struct {
	gorm.Model
	UUID       string `gorm:"uniqueIndex;not null"`
	TopologyID uint   `gorm:"index;not null"`
	FilePath   string `gorm:"not null"`
	Content    []byte `gorm:"not null"`
}

// --- DTOs ---

type CreateRequest struct {
	Name         string `json:"name" binding:"required"`
	Definition   string `json:"definition" binding:"required"` // YAML string
	CollectionID string `json:"collectionId" binding:"required"`
}

type UpdateRequest struct {
	Name       *string `json:"name"`
	Definition *string `json:"definition"`
}

type CreateBindFileRequest struct {
	FilePath string `json:"filePath" binding:"required"`
	Content  string `json:"content" binding:"required"` // base64 or plain text
}

type UpdateBindFileRequest struct {
	FilePath *string `json:"filePath"`
	Content  *string `json:"content"`
}

type BindFileResponse struct {
	UUID     string    `json:"uuid"`
	FilePath string    `json:"filePath"`
	CreatedAt time.Time `json:"createdAt"`
}

type Response struct {
	UUID         string             `json:"uuid"`
	Name         string             `json:"name"`
	Definition   string             `json:"definition"`
	CollectionID string             `json:"collectionId"`
	CreatorID    string             `json:"creatorId"`
	BindFiles    []BindFileResponse `json:"bindFiles"`
	CreatedAt    time.Time          `json:"createdAt"`
	UpdatedAt    time.Time          `json:"updatedAt"`
}
