package worker

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/labbed/platform/internal/auth"
)

type WorkerHandler struct {
	service *WorkerService
}

func NewHandler(service *WorkerService) *WorkerHandler {
	return &WorkerHandler{service: service}
}

// --- Admin handlers ---

func (h *WorkerHandler) HandleGetAll(c *gin.Context) {
	orgID := auth.GetOrgDBID(c)

	var workers []Response
	var err error
	if orgID > 0 {
		workers, err = h.service.GetAllByOrg(orgID)
	} else {
		workers, err = h.service.GetAll()
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, workers)
}

// requireWorkerOrg checks worker belongs to the request's org context.
func (h *WorkerHandler) requireWorkerOrg(c *gin.Context, workerUUID string) bool {
	if orgID := auth.GetOrgDBID(c); orgID > 0 {
		if err := h.service.CheckOrgOwnership(workerUUID, orgID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "worker not found"})
			return true
		}
	}
	return false
}

func (h *WorkerHandler) HandleGetByID(c *gin.Context) {
	id := c.Param("id")
	if h.requireWorkerOrg(c, id) {
		return
	}

	resp, err := h.service.GetByUUID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *WorkerHandler) HandleCreate(c *gin.Context) {
	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: name and address are required"})
		return
	}

	orgID := auth.GetOrgDBID(c)
	resp, err := h.service.CreateWithOrg(req, orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *WorkerHandler) HandleUpdate(c *gin.Context) {
	id := c.Param("id")
	if h.requireWorkerOrg(c, id) {
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

func (h *WorkerHandler) HandleDelete(c *gin.Context) {
	id := c.Param("id")
	if h.requireWorkerOrg(c, id) {
		return
	}

	if err := h.service.Delete(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// --- Internal handlers (worker-to-platform) ---

func (h *WorkerHandler) HandleRegister(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: name, address, and secret are required"})
		return
	}

	resp, err := h.service.Register(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *WorkerHandler) HandleHeartbeat(c *gin.Context) {
	var req HeartbeatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: workerId is required"})
		return
	}

	if err := h.service.Heartbeat(req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
