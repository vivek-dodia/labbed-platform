package organization

import (
	"github.com/gin-gonic/gin"
)

// RegisterPublicRoutes registers signup route (no auth required).
func RegisterPublicRoutes(router *gin.Engine, handler *OrgHandler) {
	router.POST("/api/v1/auth/signup", handler.HandleSignup)
}

// RegisterRoutes registers authenticated org management routes.
func RegisterRoutes(apiGroup *gin.RouterGroup, handler *OrgHandler) {
	orgs := apiGroup.Group("/organizations")
	{
		orgs.GET("", handler.HandleGetMyOrgs)
		orgs.POST("", handler.HandleCreate)
		orgs.GET("/:id", handler.HandleGetByID)
		orgs.PUT("/:id", handler.HandleUpdate)
		orgs.GET("/:id/members", handler.HandleGetMembers)
		orgs.POST("/:id/members", handler.HandleAddMember)
		orgs.DELETE("/:id/members/:userId", handler.HandleRemoveMember)
	}
}
