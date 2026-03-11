package collection

import (
	"time"

	"gorm.io/gorm"
)

type Collection struct {
	gorm.Model
	UUID         string `gorm:"uniqueIndex;not null"`
	Name         string `gorm:"uniqueIndex:idx_col_org_name;not null"`
	OrgID        uint   `gorm:"uniqueIndex:idx_col_org_name;index;not null;default:0"`
	CreatorID    uint   `gorm:"not null"`
	PublicRead   bool   `gorm:"default:false"`
	PublicDeploy bool   `gorm:"default:false"`
}

type CollectionMember struct {
	gorm.Model
	CollectionID uint   `gorm:"uniqueIndex:idx_col_user;not null"`
	UserID       uint   `gorm:"uniqueIndex:idx_col_user;not null"`
	Role         string `gorm:"not null;default:'viewer'"` // owner, editor, deployer, viewer
}

// --- DTOs ---

type CreateRequest struct {
	Name         string `json:"name" binding:"required"`
	PublicRead   bool   `json:"publicRead"`
	PublicDeploy bool   `json:"publicDeploy"`
}

type UpdateRequest struct {
	Name         *string `json:"name"`
	PublicRead   *bool   `json:"publicRead"`
	PublicDeploy *bool   `json:"publicDeploy"`
}

type AddMemberRequest struct {
	UserID string `json:"userId" binding:"required"`
	Role   string `json:"role" binding:"required"` // editor, deployer, viewer
}

type Response struct {
	UUID         string    `json:"uuid"`
	Name         string    `json:"name"`
	PublicRead   bool      `json:"publicRead"`
	PublicDeploy bool      `json:"publicDeploy"`
	CreatorID    string    `json:"creatorId"`
	CreatedAt    time.Time `json:"createdAt"`
}

func (c *Collection) ToResponse(creatorUUID string) Response {
	return Response{
		UUID:         c.UUID,
		Name:         c.Name,
		PublicRead:   c.PublicRead,
		PublicDeploy: c.PublicDeploy,
		CreatorID:    creatorUUID,
		CreatedAt:    c.CreatedAt,
	}
}
