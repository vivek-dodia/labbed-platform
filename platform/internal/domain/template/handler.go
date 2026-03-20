package template

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/labbed/platform/internal/auth"
)

type TemplateHandler struct {
	service              *TemplateService
	resolveCollectionID  func(uuid string) (uint, error)
	resolveUserID        func(uuid string) (uint, error)
	getUserCollectionIDs func(userID uint, isAdmin bool) ([]uint, error)
}

func NewHandler(
	service *TemplateService,
	resolveCollectionID func(uuid string) (uint, error),
	resolveUserID func(uuid string) (uint, error),
	getUserCollectionIDs func(userID uint, isAdmin bool) ([]uint, error),
) *TemplateHandler {
	return &TemplateHandler{
		service:              service,
		resolveCollectionID:  resolveCollectionID,
		resolveUserID:        resolveUserID,
		getUserCollectionIDs: getUserCollectionIDs,
	}
}

func (h *TemplateHandler) HandleCreate(c *gin.Context) {
	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: name, definition, and collectionId are required"})
		return
	}

	userUUID := auth.GetUserID(c)
	if userUUID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	userID, err := h.resolveUserID(userUUID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	collectionID, err := h.resolveCollectionID(req.CollectionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "collection not found"})
		return
	}

	// Verify the user has access to this collection
	isAdmin := auth.IsAdmin(c)
	collectionIDs, err := h.getUserCollectionIDs(userID, isAdmin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check collection access"})
		return
	}

	if !containsID(collectionIDs, collectionID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "you do not have access to this collection"})
		return
	}

	orgID := auth.GetOrgDBID(c)
	resp, err := h.service.CreateWithOrg(userID, collectionID, orgID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *TemplateHandler) HandleGetAll(c *gin.Context) {
	orgID := auth.GetOrgDBID(c)

	// Org-scoped: return templates belonging to this org
	if orgID > 0 {
		resp, err := h.service.GetAllByOrg(orgID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, resp)
		return
	}

	// Fallback: legacy behavior
	userUUID := auth.GetUserID(c)
	isAdmin := auth.IsAdmin(c)

	if isAdmin {
		resp, err := h.service.GetAllAdmin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, resp)
		return
	}

	userID, err := h.resolveUserID(userUUID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	collectionIDs, err := h.getUserCollectionIDs(userID, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve accessible collections"})
		return
	}

	resp, err := h.service.GetAll(collectionIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// requireTemplateOrg checks template belongs to the request's org context.
func (h *TemplateHandler) requireTemplateOrg(c *gin.Context, templateUUID string) bool {
	if orgID := auth.GetOrgDBID(c); orgID > 0 {
		if err := h.service.CheckOrgOwnership(templateUUID, orgID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "template not found"})
			return true
		}
	}
	return false
}

func (h *TemplateHandler) HandleGetByID(c *gin.Context) {
	id := c.Param("id")
	if h.requireTemplateOrg(c, id) {
		return
	}

	resp, err := h.service.GetByUUID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *TemplateHandler) HandleUpdate(c *gin.Context) {
	id := c.Param("id")
	if h.requireTemplateOrg(c, id) {
		return
	}

	var req UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	resp, err := h.service.Update(id, req)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *TemplateHandler) HandleDelete(c *gin.Context) {
	id := c.Param("id")
	if h.requireTemplateOrg(c, id) {
		return
	}

	if err := h.service.Delete(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *TemplateHandler) HandleCreateBindFile(c *gin.Context) {
	templateUUID := c.Param("id")
	if h.requireTemplateOrg(c, templateUUID) {
		return
	}

	var req CreateBindFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: filePath and content are required"})
		return
	}

	resp, err := h.service.CreateBindFile(templateUUID, req)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *TemplateHandler) HandleUpdateBindFile(c *gin.Context) {
	templateUUID := c.Param("id")
	if h.requireTemplateOrg(c, templateUUID) {
		return
	}

	fileUUID := c.Param("fileId")

	var req UpdateBindFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	resp, err := h.service.UpdateBindFile(fileUUID, req)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *TemplateHandler) HandleDeleteBindFile(c *gin.Context) {
	templateUUID := c.Param("id")
	if h.requireTemplateOrg(c, templateUUID) {
		return
	}

	fileUUID := c.Param("fileId")

	if err := h.service.DeleteBindFile(fileUUID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *TemplateHandler) HandleValidate(c *gin.Context) {
	var req struct {
		Definition string `json:"definition" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "definition is required"})
		return
	}

	errors, warnings := h.service.Validate(req.Definition)
	c.JSON(http.StatusOK, gin.H{
		"valid":    len(errors) == 0,
		"errors":   errors,
		"warnings": warnings,
	})
}

func containsID(ids []uint, target uint) bool {
	for _, id := range ids {
		if id == target {
			return true
		}
	}
	return false
}
