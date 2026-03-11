package collection

import (
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup, handler *CollectionHandler) {
	r.GET("", handler.HandleGetAll)
	r.POST("", handler.HandleCreate)
	r.GET("/:id", handler.HandleGetByID)
	r.PUT("/:id", handler.HandleUpdate)
	r.DELETE("/:id", handler.HandleDelete)
	r.POST("/:id/members", handler.HandleAddMember)
	r.DELETE("/:id/members/:userId", handler.HandleRemoveMember)
}
