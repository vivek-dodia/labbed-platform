package topology

import (
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup, handler *TopologyHandler) {
	r.POST("", handler.HandleCreate)
	r.GET("", handler.HandleGetAll)
	r.GET("/:id", handler.HandleGetByID)
	r.PUT("/:id", handler.HandleUpdate)
	r.DELETE("/:id", handler.HandleDelete)

	// Bind file sub-routes
	r.POST("/:id/files", handler.HandleCreateBindFile)
	r.PATCH("/:id/files/:fileId", handler.HandleUpdateBindFile)
	r.DELETE("/:id/files/:fileId", handler.HandleDeleteBindFile)
}
