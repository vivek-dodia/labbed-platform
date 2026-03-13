package nosimage

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/labbed/platform/internal/auth"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) HandleGetAll(c *gin.Context) {
	orgID := auth.GetOrgDBID(c)
	images, err := h.service.GetAvailable(orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, images)
}

func (h *Handler) HandleCreate(c *gin.Context) {
	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name, clabKind, and dockerImage are required"})
		return
	}
	orgID := auth.GetOrgDBID(c)
	resp, err := h.service.Create(orgID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, resp)
}

func (h *Handler) HandleDelete(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.Delete(id); err != nil {
		if err.Error() == "cannot delete system NOS image" {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}
