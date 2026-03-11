package api

import (
	"github.com/gin-gonic/gin"
)

// SetupRoutes configures the worker API routes.
func SetupRoutes(router *gin.Engine, handler *Handler, workerSecret string) {
	// Public health check
	router.GET("/health", handler.HandleHealth)

	// Protected routes (platform-to-worker calls, authenticated by shared secret)
	api := router.Group("/api/v1")
	api.Use(secretAuthMiddleware(workerSecret))
	{
		labs := api.Group("/labs")
		{
			labs.POST("/deploy", handler.HandleDeploy)
			labs.POST("/destroy", handler.HandleDestroy)
			labs.POST("/inspect", handler.HandleInspect)
			labs.POST("/exec", handler.HandleExec)
		}
	}
}

// secretAuthMiddleware validates the shared secret from the platform.
func secretAuthMiddleware(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("X-Worker-Secret")
		if header == "" || header != secret {
			c.AbortWithStatusJSON(401, gin.H{"error": "unauthorized"})
			return
		}
		c.Next()
	}
}
