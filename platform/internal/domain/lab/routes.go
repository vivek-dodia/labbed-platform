package lab

import (
	"github.com/gin-gonic/gin"
	"github.com/labbed/platform/internal/auth"
)

// RegisterRoutes sets up authenticated routes for lab management.
func RegisterRoutes(apiGroup *gin.RouterGroup, handler *LabHandler) {
	labs := apiGroup.Group("/labs")
	{
		// All members can read, create, deploy, destroy, clone
		labs.GET("", handler.HandleGetAll)
		labs.POST("", handler.HandleCreate)
		labs.GET("/:id", handler.HandleGetByID)
		labs.PUT("/:id", handler.HandleUpdate)
		labs.POST("/:id/deploy", handler.HandleDeploy)
		labs.POST("/:id/destroy", handler.HandleDestroy)
		labs.POST("/:id/clone", handler.HandleClone)
		labs.GET("/:id/nodes", handler.HandleGetNodes)
		labs.GET("/:id/events", handler.HandleGetEvents)

		// Admin/owner only
		admin := labs.Group("")
		admin.Use(auth.RequireOrgRole("admin"))
		{
			admin.DELETE("/:id", handler.HandleDelete)
		}
	}
}

// RegisterInternalRoutes sets up internal routes for worker-to-platform callbacks.
func RegisterInternalRoutes(internalGroup *gin.RouterGroup, handler *LabHandler) {
	internalGroup.POST("/labs/status", handler.HandleStatusUpdate)
	internalGroup.POST("/labs/nodes", handler.HandleNodeUpdate)
	internalGroup.POST("/labs/logs", handler.HandleLogPush)
}
