package worker

import (
	"github.com/gin-gonic/gin"
	"github.com/labbed/platform/internal/auth"
)

// RegisterRoutes sets up admin routes for worker management.
func RegisterRoutes(apiGroup *gin.RouterGroup, handler *WorkerHandler) {
	workers := apiGroup.Group("/workers")
	workers.Use(auth.AdminRequired())
	{
		workers.GET("", handler.HandleGetAll)
		workers.POST("", handler.HandleCreate)
		workers.GET("/:id", handler.HandleGetByID)
		workers.PUT("/:id", handler.HandleUpdate)
		workers.DELETE("/:id", handler.HandleDelete)
	}
}

// RegisterInternalRoutes sets up internal routes for worker-to-platform communication.
func RegisterInternalRoutes(internalGroup *gin.RouterGroup, handler *WorkerHandler) {
	internalGroup.POST("/workers/register", handler.HandleRegister)
	internalGroup.POST("/workers/heartbeat", handler.HandleHeartbeat)
}
