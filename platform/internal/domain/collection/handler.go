package collection

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/labbed/platform/internal/auth"
)

type CollectionHandler struct {
	service       *CollectionService
	resolveUserID func(uuid string) (uint, error)
}

func NewHandler(service *CollectionService, resolveUserID func(uuid string) (uint, error)) *CollectionHandler {
	return &CollectionHandler{
		service:       service,
		resolveUserID: resolveUserID,
	}
}

func (h *CollectionHandler) HandleCreate(c *gin.Context) {
	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userUUID := auth.GetUserID(c)
	userID, err := h.resolveUserID(userUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve user"})
		return
	}

	resp, err := h.service.Create(userID, userUUID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *CollectionHandler) HandleGetAll(c *gin.Context) {
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

func (h *CollectionHandler) HandleGetByID(c *gin.Context) {
	uuid := c.Param("id")

	resp, err := h.service.GetByUUID(uuid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *CollectionHandler) HandleUpdate(c *gin.Context) {
	uuid := c.Param("id")

	var req UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userUUID := auth.GetUserID(c)
	isAdmin := auth.IsAdmin(c)

	userID, err := h.resolveUserID(userUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve user"})
		return
	}

	resp, err := h.service.Update(uuid, userID, isAdmin, req)
	if err != nil {
		if strings.Contains(err.Error(), "only the creator") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *CollectionHandler) HandleDelete(c *gin.Context) {
	uuid := c.Param("id")

	userUUID := auth.GetUserID(c)
	isAdmin := auth.IsAdmin(c)

	userID, err := h.resolveUserID(userUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve user"})
		return
	}

	err = h.service.Delete(uuid, userID, isAdmin)
	if err != nil {
		if strings.Contains(err.Error(), "only the creator") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *CollectionHandler) HandleAddMember(c *gin.Context) {
	collectionUUID := c.Param("id")

	var req AddMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userUUID := auth.GetUserID(c)
	isAdmin := auth.IsAdmin(c)

	userID, err := h.resolveUserID(userUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve user"})
		return
	}

	err = h.service.AddMember(collectionUUID, req, userID, isAdmin, h.resolveUserID)
	if err != nil {
		if strings.Contains(err.Error(), "only collection owners") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "member added"})
}

func (h *CollectionHandler) HandleRemoveMember(c *gin.Context) {
	collectionUUID := c.Param("id")
	memberUserUUID := c.Param("userId")

	userUUID := auth.GetUserID(c)
	isAdmin := auth.IsAdmin(c)

	userID, err := h.resolveUserID(userUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve user"})
		return
	}

	err = h.service.RemoveMember(collectionUUID, memberUserUUID, userID, isAdmin, h.resolveUserID)
	if err != nil {
		if strings.Contains(err.Error(), "only collection owners") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
