package organization

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/labbed/platform/internal/auth"
)

type OrgHandler struct {
	service        *OrgService
	resolveUserID  func(uuid string) (uint, error)
	resolveUserInfo func(id uint) (string, string, string, error) // uuid, email, name
}

func NewHandler(
	service *OrgService,
	resolveUserID func(uuid string) (uint, error),
	resolveUserInfo func(id uint) (string, string, string, error),
) *OrgHandler {
	return &OrgHandler{
		service:        service,
		resolveUserID:  resolveUserID,
		resolveUserInfo: resolveUserInfo,
	}
}

// HandleSignup is a public endpoint for self-service registration.
func (h *OrgHandler) HandleSignup(c *gin.Context) {
	var req SignupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email, password, name, and orgName are required"})
		return
	}

	resp, _, err := h.service.Signup(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

// HandleCreate creates a new organization for the authenticated user.
func (h *OrgHandler) HandleCreate(c *gin.Context) {
	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	userUUID := auth.GetUserID(c)
	userDBID, err := h.resolveUserID(userUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve user"})
		return
	}

	resp, err := h.service.Create(userDBID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

// HandleGetMyOrgs returns all orgs the authenticated user belongs to.
func (h *OrgHandler) HandleGetMyOrgs(c *gin.Context) {
	userUUID := auth.GetUserID(c)
	userDBID, err := h.resolveUserID(userUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve user"})
		return
	}

	orgs, err := h.service.GetUserOrgs(userDBID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, orgs)
}

// HandleGetByID returns an organization by UUID.
func (h *OrgHandler) HandleGetByID(c *gin.Context) {
	id := c.Param("id")

	resp, err := h.service.GetByUUID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// HandleUpdate modifies an organization.
func (h *OrgHandler) HandleUpdate(c *gin.Context) {
	id := c.Param("id")

	var req UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	resp, err := h.service.Update(id, req)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// HandleGetMembers returns all members of an organization.
func (h *OrgHandler) HandleGetMembers(c *gin.Context) {
	id := c.Param("id")

	members, err := h.service.GetMembers(id, h.resolveUserInfo)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, members)
}

// HandleAddMember adds a user to an organization.
func (h *OrgHandler) HandleAddMember(c *gin.Context) {
	id := c.Param("id")

	var req AddMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "userId and role are required"})
		return
	}

	if err := h.service.AddMember(id, req.UserID, req.Role); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"status": "ok"})
}

// HandleRemoveMember removes a user from an organization.
func (h *OrgHandler) HandleRemoveMember(c *gin.Context) {
	id := c.Param("id")
	userID := c.Param("userId")

	if err := h.service.RemoveMember(id, userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
