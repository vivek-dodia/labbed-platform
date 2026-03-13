package lab

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/labbed/platform/internal/auth"
	"github.com/labbed/platform/internal/ws"
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
	hub                  *ws.Hub
	resolveUserID        func(uuid string) (uint, error)
	getUserCollectionIDs func(userID uint, isAdmin bool) ([]uint, error)
}

func NewHandler(
	service *LabService,
	hub *ws.Hub,
	resolveUserID func(uuid string) (uint, error),
	getUserCollectionIDs func(userID uint, isAdmin bool) ([]uint, error),
) *LabHandler {
	return &LabHandler{
		service:              service,
		hub:                  hub,
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

	orgID := auth.GetOrgDBID(c)
	resp, err := h.service.CreateWithOrg(creatorID, orgID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *LabHandler) HandleGetAll(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")
	state := c.Query("state")
	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	orgID := auth.GetOrgDBID(c)

	// If org context is set, scope to org
	if orgID > 0 {
		resp, err := h.service.GetAllPaginatedByOrg(orgID, state, limit, offset)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, resp)
		return
	}

	// Fallback: legacy behavior without org context
	userUUID := auth.GetUserID(c)
	isAdmin := auth.IsAdmin(c)

	userID, err := h.resolveUserID(userUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve user"})
		return
	}

	resp, err := h.service.GetAllPaginated(userID, isAdmin, state, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// requireLabOrg checks lab belongs to the request's org context.
// Returns true if the request should be aborted.
func (h *LabHandler) requireLabOrg(c *gin.Context, labUUID string) bool {
	if orgID := auth.GetOrgDBID(c); orgID > 0 {
		if err := h.service.CheckOrgOwnership(labUUID, orgID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "lab not found"})
			return true
		}
	}
	return false
}

func (h *LabHandler) HandleGetByID(c *gin.Context) {
	id := c.Param("id")
	if h.requireLabOrg(c, id) {
		return
	}

	resp, err := h.service.GetByUUID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *LabHandler) HandleUpdate(c *gin.Context) {
	id := c.Param("id")
	if h.requireLabOrg(c, id) {
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

func (h *LabHandler) HandleDelete(c *gin.Context) {
	id := c.Param("id")
	if h.requireLabOrg(c, id) {
		return
	}

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
	if h.requireLabOrg(c, id) {
		return
	}

	// Parse optional deploy body with node image overrides
	var req DeployRequest
	// Ignore bind errors — body is optional; empty body = no overrides
	_ = c.ShouldBindJSON(&req)

	if err := h.service.Deploy(id, req.NodeImages); err != nil {
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
	if h.requireLabOrg(c, id) {
		return
	}

	if err := h.service.Destroy(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "destroy initiated"})
}

func (h *LabHandler) HandleGetNodes(c *gin.Context) {
	id := c.Param("id")
	if h.requireLabOrg(c, id) {
		return
	}

	resp, err := h.service.GetByUUID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp.Nodes)
}

func (h *LabHandler) HandleClone(c *gin.Context) {
	id := c.Param("id")
	if h.requireLabOrg(c, id) {
		return
	}

	userUUID := auth.GetUserID(c)
	creatorID, err := h.resolveUserID(userUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve user"})
		return
	}

	orgID := auth.GetOrgDBID(c)
	resp, err := h.service.CloneWithOrg(id, creatorID, orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *LabHandler) HandleGetEvents(c *gin.Context) {
	id := c.Param("id")
	if h.requireLabOrg(c, id) {
		return
	}

	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")
	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	resp, err := h.service.GetEvents(id, limit, offset)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
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

	// Broadcast state change via WebSocket
	if h.hub != nil {
		labResp, err := h.service.GetByUUID(req.LabUUID)
		if err == nil {
			h.hub.BroadcastToChannel(fmt.Sprintf("lab:%s", req.LabUUID), ws.MsgLabState, labResp)
		}
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

	// Broadcast node update via WebSocket
	if h.hub != nil {
		h.hub.BroadcastToChannel(fmt.Sprintf("lab:%s:nodes", req.LabUUID), ws.MsgLabNodes, req.Nodes)
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// HandleCapture runs tcpdump on a container interface via the worker.
func (h *LabHandler) HandleCapture(c *gin.Context) {
	labUUID := c.Param("id")
	if h.requireLabOrg(c, labUUID) {
		return
	}

	var req struct {
		NodeName  string `json:"nodeName" binding:"required"`
		Interface string `json:"interface" binding:"required"`
		Count     int    `json:"count"`
		Filter    string `json:"filter"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	output, err := h.service.Capture(labUUID, req.NodeName, req.Interface, req.Count, req.Filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"output": output})
}

func (h *LabHandler) HandleLogPush(c *gin.Context) {
	var req LogPushRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Broadcast log line via WebSocket
	if h.hub != nil {
		h.hub.BroadcastToChannel(
			fmt.Sprintf("lab:%s:logs", req.LabUUID),
			ws.MsgLabLog,
			map[string]string{"line": req.Line, "level": req.Level},
		)
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
