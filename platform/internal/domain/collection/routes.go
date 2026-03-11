package collection

import (
	"github.com/gin-gonic/gin"
	"github.com/labbed/platform/internal/auth"
)

func RegisterRoutes(r *gin.RouterGroup, handler *CollectionHandler) {
	r.GET("", handler.HandleGetAll)
	r.POST("", handler.HandleCreate)
	r.GET("/:id", handler.HandleGetByID)
	r.PUT("/:id", handler.HandleUpdate)

	// Admin/owner only
	admin := r.Group("")
	admin.Use(auth.RequireOrgRole("admin"))
	{
		admin.DELETE("/:id", handler.HandleDelete)
		admin.POST("/:id/members", handler.HandleAddMember)
		admin.DELETE("/:id/members/:userId", handler.HandleRemoveMember)
	}
}
