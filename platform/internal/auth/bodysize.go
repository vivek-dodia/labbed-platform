package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// MaxBodySize limits the request body size.
// Default max: 1MB. For topology uploads, use a higher limit.
func MaxBodySize(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Body != nil {
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		}
		c.Next()
	}
}
