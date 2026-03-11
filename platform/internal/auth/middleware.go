package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthRequired validates JWT access tokens from the Authorization header.
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization header must be: Bearer <token>"})
			return
		}

		claims, err := ValidateToken(parts[1], AccessToken)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("is_admin", claims.IsAdmin)
		c.Next()
	}
}

// AdminRequired checks that the authenticated user is an admin.
func AdminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		isAdmin, exists := c.Get("is_admin")
		if !exists || !isAdmin.(bool) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin privileges required"})
			return
		}
		c.Next()
	}
}

// WorkerAuth validates shared-secret auth for worker-to-platform calls.
func WorkerAuth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("X-Worker-Secret")
		if header == "" || header != secret {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid worker credentials"})
			return
		}
		c.Next()
	}
}

// GetUserID extracts the user ID from the gin context.
func GetUserID(c *gin.Context) string {
	return c.GetString("user_id")
}

// IsAdmin checks if the current user is an admin.
func IsAdmin(c *gin.Context) bool {
	v, _ := c.Get("is_admin")
	b, _ := v.(bool)
	return b
}
