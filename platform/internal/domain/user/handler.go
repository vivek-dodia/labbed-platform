package user

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/labbed/platform/internal/auth"
	"github.com/labbed/platform/internal/config"
)

type UserHandler struct {
	service    *UserService
	googleAuth *auth.GoogleOAuth
	createOrg  func(userDBID uint, name string) error // callback to create personal org on first Google login
}

func NewHandler(service *UserService) *UserHandler {
	return &UserHandler{service: service}
}

// SetGoogleAuth configures Google OAuth on the handler.
func (h *UserHandler) SetGoogleAuth(g *auth.GoogleOAuth) {
	h.googleAuth = g
}

// SetCreateOrgCallback sets the callback for creating a personal org on first Google login.
func (h *UserHandler) SetCreateOrgCallback(fn func(userDBID uint, name string) error) {
	h.createOrg = fn
}

func (h *UserHandler) HandleLogin(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: email and password are required"})
		return
	}

	resp, err := h.service.Login(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *UserHandler) HandleRefresh(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: refreshToken is required"})
		return
	}

	resp, err := h.service.RefreshToken(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *UserHandler) HandleGetAuthConfig(c *gin.Context) {
	c.JSON(http.StatusOK, AuthConfigResponse{
		EnableNative: config.AppConfig.Auth.EnableNative,
		EnableGoogle: config.AppConfig.Auth.Google.Enabled,
	})
}

// HandleGoogleAuthorize returns the Google OAuth2 authorization URL.
func (h *UserHandler) HandleGoogleAuthorize(c *gin.Context) {
	if h.googleAuth == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "google auth not enabled"})
		return
	}

	url, state := h.googleAuth.AuthURL()
	c.JSON(http.StatusOK, gin.H{"url": url, "state": state})
}

// HandleGoogleCallback exchanges the authorization code for tokens.
// The frontend sends the code after Google redirects back.
func (h *UserHandler) HandleGoogleCallback(c *gin.Context) {
	if h.googleAuth == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "google auth not enabled"})
		return
	}

	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "code is required"})
		return
	}

	info, err := h.googleAuth.Exchange(c.Request.Context(), req.Code)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "google authentication failed"})
		return
	}

	u, isNew, err := h.service.FindOrCreateByGoogle(info.Sub, info.Email, info.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create personal org for new Google users
	if isNew && h.createOrg != nil {
		orgName := u.DisplayName + "'s Org"
		if err := h.createOrg(u.ID, orgName); err != nil {
			// Log but don't fail the login
			_ = err
		}
	}

	accessToken, err := auth.GenerateAccessToken(u.UUID, u.Email, u.IsAdmin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate access token"})
		return
	}

	refreshToken, err := auth.GenerateRefreshToken(u.UUID, u.Email, u.IsAdmin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate refresh token"})
		return
	}

	c.JSON(http.StatusOK, LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         u.ToResponse(),
	})
}

func (h *UserHandler) HandleGetMe(c *gin.Context) {
	userID := auth.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	resp, err := h.service.GetUser(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *UserHandler) HandleGetAll(c *gin.Context) {
	users, err := h.service.GetAllUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, users)
}

func (h *UserHandler) HandleCreate(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: email, password, and displayName are required"})
		return
	}

	resp, err := h.service.CreateUser(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *UserHandler) HandleUpdate(c *gin.Context) {
	id := c.Param("id")

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	resp, err := h.service.UpdateUser(id, req)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *UserHandler) HandleDelete(c *gin.Context) {
	id := c.Param("id")

	if err := h.service.DeleteUser(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *UserHandler) HandleChangePassword(c *gin.Context) {
	id := c.Param("id")

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: newPassword is required (min 6 characters)"})
		return
	}

	isSuperuser := auth.IsAdmin(c)

	if err := h.service.ChangePassword(id, req.CurrentPassword, req.NewPassword, isSuperuser); err != nil {
		status := http.StatusBadRequest
		if err.Error() == "user not found" {
			status = http.StatusNotFound
		} else if err.Error() == "current password is incorrect" {
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "password changed successfully"})
}
