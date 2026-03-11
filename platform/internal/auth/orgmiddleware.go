package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

const (
	orgIDKey   = "org_id"   // org UUID string
	orgDBIDKey = "org_db_id" // org database uint ID
	orgRoleKey = "org_role"  // user's role in the org
)

// OrgMembershipChecker validates if a user belongs to an org and returns (orgDBID, role, error).
type OrgMembershipChecker func(orgUUID string, userDBID uint) (uint, string, error)

// OrgContext middleware extracts X-Org-ID header, validates membership,
// and sets org context on the request. Routes that require org scoping
// should use this middleware.
func OrgContext(checker OrgMembershipChecker, resolveUserID func(string) (uint, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID := c.GetHeader("X-Org-ID")
		if orgID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "X-Org-ID header is required"})
			c.Abort()
			return
		}

		userUUID := GetUserID(c)
		if userUUID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			c.Abort()
			return
		}

		userDBID, err := resolveUserID(userUUID)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
			c.Abort()
			return
		}

		// Platform admins bypass org membership check
		if IsAdmin(c) {
			orgDBID, _, err := checker(orgID, userDBID)
			if err != nil && orgDBID == 0 {
				// Org itself doesn't exist (orgDBID=0 means lookup failed)
				c.JSON(http.StatusNotFound, gin.H{"error": "organization not found"})
				c.Abort()
				return
			}
			// orgDBID > 0 means org exists; ignore membership error for admins
			c.Set(orgIDKey, orgID)
			c.Set(orgDBIDKey, orgDBID)
			c.Set(orgRoleKey, "admin")
			c.Next()
			return
		}

		orgDBID, role, err := checker(orgID, userDBID)
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "you are not a member of this organization"})
			c.Abort()
			return
		}

		c.Set(orgIDKey, orgID)
		c.Set(orgDBIDKey, orgDBID)
		c.Set(orgRoleKey, role)
		c.Next()
	}
}

// GetOrgID returns the org UUID from the request context.
func GetOrgID(c *gin.Context) string {
	v, _ := c.Get(orgIDKey)
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// GetOrgDBID returns the org database ID from the request context.
func GetOrgDBID(c *gin.Context) uint {
	v, _ := c.Get(orgDBIDKey)
	if id, ok := v.(uint); ok {
		return id
	}
	return 0
}

// GetOrgRole returns the user's role in the current org.
func GetOrgRole(c *gin.Context) string {
	v, _ := c.Get(orgRoleKey)
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// IsOrgAdmin returns true if the user is an admin or owner of the current org.
func IsOrgAdmin(c *gin.Context) bool {
	role := GetOrgRole(c)
	return role == "admin" || role == "owner"
}
