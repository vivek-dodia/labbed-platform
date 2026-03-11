package topology

import (
	"github.com/gin-gonic/gin"
	"github.com/labbed/platform/internal/auth"
)

func RegisterRoutes(r *gin.RouterGroup, handler *TopologyHandler) {
	// Read operations
	r.GET("", handler.HandleGetAll)
	r.GET("/:id", handler.HandleGetByID)

	// Write operations with higher body size limit (5MB for YAML + bind files)
	write := r.Group("")
	write.Use(auth.MaxBodySize(5 << 20))
	{
		write.POST("", handler.HandleCreate)
		write.POST("/validate", handler.HandleValidate)
		write.PUT("/:id", handler.HandleUpdate)
		write.POST("/:id/files", handler.HandleCreateBindFile)
		write.PATCH("/:id/files/:fileId", handler.HandleUpdateBindFile)
	}

	// Admin/owner only
	admin := r.Group("")
	admin.Use(auth.RequireOrgRole("admin"))
	{
		admin.DELETE("/:id", handler.HandleDelete)
		admin.DELETE("/:id/files/:fileId", handler.HandleDeleteBindFile)
	}
}
