package nosimage

import (
	"github.com/gin-gonic/gin"
	"github.com/labbed/platform/internal/auth"
)

func RegisterRoutes(apiGroup *gin.RouterGroup, handler *Handler) {
	images := apiGroup.Group("/nos-images")
	{
		images.GET("", handler.HandleGetAll)

		admin := images.Group("")
		admin.Use(auth.RequireOrgRole("admin"))
		{
			admin.POST("", handler.HandleCreate)
			admin.DELETE("/:id", handler.HandleDelete)
		}
	}
}
