package lab

import (
	"github.com/gin-gonic/gin"
)

// RegisterRoutes sets up authenticated routes for lab management.
func RegisterRoutes(apiGroup *gin.RouterGroup, handler *LabHandler) {
	labs := apiGroup.Group("/labs")
	{
		labs.GET("", handler.HandleGetAll)
		labs.POST("", handler.HandleCreate)
		labs.GET("/:id", handler.HandleGetByID)
		labs.PUT("/:id", handler.HandleUpdate)
		labs.DELETE("/:id", handler.HandleDelete)
		labs.POST("/:id/deploy", handler.HandleDeploy)
		labs.POST("/:id/destroy", handler.HandleDestroy)
		labs.GET("/:id/nodes", handler.HandleGetNodes)
	}
}

// RegisterInternalRoutes sets up internal routes for worker-to-platform callbacks.
func RegisterInternalRoutes(internalGroup *gin.RouterGroup, handler *LabHandler) {
	internalGroup.POST("/labs/status", handler.HandleStatusUpdate)
	internalGroup.POST("/labs/nodes", handler.HandleNodeUpdate)
}
