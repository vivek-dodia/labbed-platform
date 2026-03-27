package guide

import "github.com/gin-gonic/gin"

// RegisterTemplateRoutes adds guide endpoints to the template router group.
// These routes are for guide content and progress (read guide, track progress).
func RegisterTemplateRoutes(tmplGroup *gin.RouterGroup, handler *Handler) {
	tmplGroup.GET("/:id/guide", handler.HandleGetGuide)
	tmplGroup.GET("/:id/guide/progress", handler.HandleGetProgress)
	tmplGroup.POST("/:id/guide/progress", handler.HandleCompleteStep)
	tmplGroup.DELETE("/:id/guide/progress", handler.HandleResetProgress)
}

// RegisterLabRoutes adds guide validation endpoints to the lab router group.
// Validation requires a running lab to exec commands against.
func RegisterLabRoutes(labGroup *gin.RouterGroup, handler *Handler) {
	labGroup.POST("/:id/guide/validate", handler.HandleValidateStep)
}
