package topology

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/labbed/platform/internal/auth"
)

type TopologyHandler struct {
	service              *TopologyService
	resolveCollectionID  func(uuid string) (uint, error)
	resolveUserID        func(uuid string) (uint, error)
	getUserCollectionIDs func(userID uint, isAdmin bool) ([]uint, error)
}

func NewHandler(
	service *TopologyService,
	resolveCollectionID func(uuid string) (uint, error),
	resolveUserID func(uuid string) (uint, error),
	getUserCollectionIDs func(userID uint, isAdmin bool) ([]uint, error),
) *TopologyHandler {
	return &TopologyHandler{
		service:              service,
		resolveCollectionID:  resolveCollectionID,
		resolveUserID:        resolveUserID,
		getUserCollectionIDs: getUserCollectionIDs,
	}
}

func (h *TopologyHandler) HandleCreate(c *gin.Context) {
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

	resp, err := h.service.Create(userID, collectionID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *TopologyHandler) HandleGetAll(c *gin.Context) {
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

func (h *TopologyHandler) HandleGetByID(c *gin.Context) {
	id := c.Param("id")

	resp, err := h.service.GetByUUID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *TopologyHandler) HandleUpdate(c *gin.Context) {
	id := c.Param("id")

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

func (h *TopologyHandler) HandleDelete(c *gin.Context) {
	id := c.Param("id")

	if err := h.service.Delete(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *TopologyHandler) HandleCreateBindFile(c *gin.Context) {
	topologyUUID := c.Param("id")

	var req CreateBindFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: filePath and content are required"})
		return
	}

	resp, err := h.service.CreateBindFile(topologyUUID, req)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *TopologyHandler) HandleUpdateBindFile(c *gin.Context) {
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

func (h *TopologyHandler) HandleDeleteBindFile(c *gin.Context) {
	fileUUID := c.Param("fileId")

	if err := h.service.DeleteBindFile(fileUUID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func containsID(ids []uint, target uint) bool {
	for _, id := range ids {
		if id == target {
			return true
		}
	}
	return false
}
