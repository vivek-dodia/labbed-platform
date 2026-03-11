package lab

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/labbed/platform/internal/auth"
)

// StatusUpdateRequest is sent by workers to report lab state changes.
type StatusUpdateRequest struct {
	LabUUID      string   `json:"labUuid" binding:"required"`
	State        LabState `json:"state" binding:"required"`
	ErrorMessage *string  `json:"errorMessage"`
}

// NodeUpdateRequest is sent by workers to push node information.
type NodeUpdateRequest struct {
	LabUUID string         `json:"labUuid" binding:"required"`
	Nodes   []NodeResponse `json:"nodes" binding:"required"`
}

type LabHandler struct {
	service              *LabService
	resolveUserID        func(uuid string) (uint, error)
	getUserCollectionIDs func(userID uint, isAdmin bool) ([]uint, error)
}

func NewHandler(
	service *LabService,
	resolveUserID func(uuid string) (uint, error),
	getUserCollectionIDs func(userID uint, isAdmin bool) ([]uint, error),
) *LabHandler {
	return &LabHandler{
		service:              service,
		resolveUserID:        resolveUserID,
		getUserCollectionIDs: getUserCollectionIDs,
	}
}

func (h *LabHandler) HandleCreate(c *gin.Context) {
	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: name and topologyId are required"})
		return
	}

	userUUID := auth.GetUserID(c)
	creatorID, err := h.resolveUserID(userUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve user"})
		return
	}

	resp, err := h.service.Create(creatorID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *LabHandler) HandleGetAll(c *gin.Context) {
	userUUID := auth.GetUserID(c)
	isAdmin := auth.IsAdmin(c)

	userID, err := h.resolveUserID(userUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve user"})
		return
	}

	resp, err := h.service.GetAll(userID, isAdmin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *LabHandler) HandleGetByID(c *gin.Context) {
	id := c.Param("id")

	resp, err := h.service.GetByUUID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *LabHandler) HandleUpdate(c *gin.Context) {
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

func (h *LabHandler) HandleDelete(c *gin.Context) {
	id := c.Param("id")

	if err := h.service.Delete(id); err != nil {
		if err.Error() == "cannot delete a running lab; destroy it first" {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *LabHandler) HandleDeploy(c *gin.Context) {
	id := c.Param("id")

	if err := h.service.Deploy(id); err != nil {
		if err.Error() == "no available workers with capacity" {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "deployment initiated"})
}

func (h *LabHandler) HandleDestroy(c *gin.Context) {
	id := c.Param("id")

	if err := h.service.Destroy(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "destroy initiated"})
}

func (h *LabHandler) HandleGetNodes(c *gin.Context) {
	id := c.Param("id")

	resp, err := h.service.GetByUUID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp.Nodes)
}

// --- Internal handlers (called by workers) ---

func (h *LabHandler) HandleStatusUpdate(c *gin.Context) {
	var req StatusUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: labUuid and state are required"})
		return
	}

	if err := h.service.UpdateState(req.LabUUID, req.State, req.ErrorMessage); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *LabHandler) HandleNodeUpdate(c *gin.Context) {
	var req NodeUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: labUuid and nodes are required"})
		return
	}

	if err := h.service.UpdateNodes(req.LabUUID, req.Nodes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
