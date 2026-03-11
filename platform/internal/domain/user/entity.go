package user

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	UUID         string `gorm:"uniqueIndex;not null"`
	Email        string `gorm:"uniqueIndex;not null"`
	PasswordHash string
	DisplayName  string `gorm:"not null"`
	IsAdmin      bool   `gorm:"default:false"`
	Sub          string `gorm:"index"` // OIDC subject (nullable)
}

// --- DTOs ---

type LoginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	AccessToken  string       `json:"accessToken"`
	RefreshToken string       `json:"refreshToken"`
	User         UserResponse `json:"user"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

type RefreshResponse struct {
	AccessToken string `json:"accessToken"`
}

type CreateUserRequest struct {
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required,min=6"`
	DisplayName string `json:"displayName" binding:"required"`
	IsAdmin     bool   `json:"isAdmin"`
}

type UpdateUserRequest struct {
	DisplayName *string `json:"displayName"`
	IsAdmin     *bool   `json:"isAdmin"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword" binding:"required,min=6"`
}

type UserResponse struct {
	UUID        string    `json:"uuid"`
	Email       string    `json:"email"`
	DisplayName string    `json:"displayName"`
	IsAdmin     bool      `json:"isAdmin"`
	CreatedAt   time.Time `json:"createdAt"`
}

type AuthConfigResponse struct {
	EnableNative bool `json:"enableNative"`
	EnableOIDC   bool `json:"enableOidc"`
}

func (u *User) ToResponse() UserResponse {
	return UserResponse{
		UUID:        u.UUID,
		Email:       u.Email,
		DisplayName: u.DisplayName,
		IsAdmin:     u.IsAdmin,
		CreatedAt:   u.CreatedAt,
	}
}
