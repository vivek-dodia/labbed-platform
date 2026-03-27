package guide

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

// HandleGetGuide returns the guide for a template. 404 if no guide exists.
func (h *Handler) HandleGetGuide(c *gin.Context) {
	templateUUID := c.Param("id")
	guide, err := h.service.GetGuideForTemplate(templateUUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no guide for this template"})
		return
	}
	c.JSON(http.StatusOK, guide)
}

// HandleGetProgress returns the user's progress on a template's guide.
func (h *Handler) HandleGetProgress(c *gin.Context) {
	templateUUID := c.Param("id")
	userUUID := auth.GetUserID(c)

	progress, err := h.service.GetProgress(userUUID, templateUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, progress)
}

// HandleValidateStep runs the validation check for a guide step against a running lab.
func (h *Handler) HandleValidateStep(c *gin.Context) {
	labUUID := c.Param("id")
	userUUID := auth.GetUserID(c)

	var req ValidateStepRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.service.ValidateStep(labUUID, userUUID, *req.StepIndex)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// HandleCompleteStep manually marks a step as complete.
func (h *Handler) HandleCompleteStep(c *gin.Context) {
	templateUUID := c.Param("id")
	userUUID := auth.GetUserID(c)

	var req ValidateStepRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.MarkStepComplete(userUUID, templateUUID, *req.StepIndex); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "step marked complete"})
}

// HandleResetProgress clears all progress for the current user on a template's guide.
func (h *Handler) HandleResetProgress(c *gin.Context) {
	templateUUID := c.Param("id")
	userUUID := auth.GetUserID(c)

	if err := h.service.ResetProgress(userUUID, templateUUID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "progress reset"})
}
