package organization

import (
	"time"

	"gorm.io/gorm"
)

type OrgRole string

const (
	RoleOwner  OrgRole = "owner"
	RoleAdmin  OrgRole = "admin"
	RoleMember OrgRole = "member"
)

type Organization struct {
	gorm.Model
	UUID       string `gorm:"uniqueIndex;not null"`
	Name       string `gorm:"not null"`
	Slug       string `gorm:"uniqueIndex;not null"`
	Plan       string `gorm:"not null;default:'free'"` // free, team, enterprise
	MaxLabs    int    `gorm:"not null;default:5"`
	MaxWorkers int    `gorm:"not null;default:2"`
}

type OrganizationMember struct {
	gorm.Model
	OrgID  uint    `gorm:"uniqueIndex:idx_org_user;not null"`
	UserID uint    `gorm:"uniqueIndex:idx_org_user;not null"`
	Role   OrgRole `gorm:"not null;default:'member'"`
}

// --- DTOs ---

type CreateRequest struct {
	Name string `json:"name" binding:"required"`
}

type UpdateRequest struct {
	Name       *string `json:"name"`
	Plan       *string `json:"plan"`
	MaxLabs    *int    `json:"maxLabs"`
	MaxWorkers *int    `json:"maxWorkers"`
}

type SignupRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Name     string `json:"name" binding:"required"`
	OrgName  string `json:"orgName" binding:"required"`
}

type AddMemberRequest struct {
	UserID string  `json:"userId" binding:"required"` // user UUID
	Role   OrgRole `json:"role" binding:"required"`
}

type Response struct {
	UUID       string    `json:"uuid"`
	Name       string    `json:"name"`
	Slug       string    `json:"slug"`
	Plan       string    `json:"plan"`
	MaxLabs    int       `json:"maxLabs"`
	MaxWorkers int       `json:"maxWorkers"`
	Role       OrgRole   `json:"role,omitempty"` // caller's role in this org
	CreatedAt  time.Time `json:"createdAt"`
}

type MemberResponse struct {
	UserID    string    `json:"userId"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Role      OrgRole   `json:"role"`
	JoinedAt  time.Time `json:"joinedAt"`
}
