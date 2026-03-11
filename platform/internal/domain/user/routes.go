package user

import (
	"github.com/gin-gonic/gin"
	"github.com/labbed/platform/internal/auth"
)

func RegisterRoutes(r *gin.Engine, handler *UserHandler) {
	// Public auth routes
	authGroup := r.Group("/api/v1/auth")
	{
		authGroup.POST("/login", handler.HandleLogin)
		authGroup.POST("/refresh", handler.HandleRefresh)
		authGroup.GET("/config", handler.HandleGetAuthConfig)
	}

	// Authenticated user routes
	userGroup := r.Group("/api/v1/users")
	userGroup.Use(auth.AuthRequired())
	{
		userGroup.GET("/me", handler.HandleGetMe)
		userGroup.PUT("/:id/password", handler.HandleChangePassword)
		userGroup.PUT("/:id", handler.HandleUpdate)

		// Admin-only routes
		admin := userGroup.Group("")
		admin.Use(auth.AdminRequired())
		{
			admin.GET("", handler.HandleGetAll)
			admin.POST("", handler.HandleCreate)
			admin.DELETE("/:id", handler.HandleDelete)
		}
	}
}
