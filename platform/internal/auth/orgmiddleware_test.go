package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func setupTestContext() (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	return c, w
}

func TestOrgContext_MissingHeader(t *testing.T) {
	checker := func(orgUUID string, userDBID uint) (uint, string, error) {
		return 1, "member", nil
	}
	resolver := func(uuid string) (uint, error) {
		return 1, nil
	}

	middleware := OrgContext(checker, resolver)

	c, w := setupTestContext()
	// No X-Org-ID header
	c.Set("user_id", "user-uuid-1")

	middleware(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
	if !c.IsAborted() {
		t.Error("expected request to be aborted")
	}
}

func TestOrgContext_NotAuthenticated(t *testing.T) {
	checker := func(orgUUID string, userDBID uint) (uint, string, error) {
		return 1, "member", nil
	}
	resolver := func(uuid string) (uint, error) {
		return 1, nil
	}

	middleware := OrgContext(checker, resolver)

	c, w := setupTestContext()
	c.Request.Header.Set("X-Org-ID", "org-uuid-1")
	// No user_id set

	middleware(c)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestOrgContext_UserNotFound(t *testing.T) {
	checker := func(orgUUID string, userDBID uint) (uint, string, error) {
		return 1, "member", nil
	}
	resolver := func(uuid string) (uint, error) {
		return 0, http.ErrAbortHandler // any error
	}

	middleware := OrgContext(checker, resolver)

	c, w := setupTestContext()
	c.Request.Header.Set("X-Org-ID", "org-uuid-1")
	c.Set("user_id", "user-uuid-1")

	middleware(c)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestOrgContext_NonMember(t *testing.T) {
	checker := func(orgUUID string, userDBID uint) (uint, string, error) {
		return 0, "", http.ErrAbortHandler // not a member
	}
	resolver := func(uuid string) (uint, error) {
		return 1, nil
	}

	middleware := OrgContext(checker, resolver)

	c, w := setupTestContext()
	c.Request.Header.Set("X-Org-ID", "org-uuid-1")
	c.Set("user_id", "user-uuid-1")

	middleware(c)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestOrgContext_MemberSuccess(t *testing.T) {
	checker := func(orgUUID string, userDBID uint) (uint, string, error) {
		return 42, "admin", nil
	}
	resolver := func(uuid string) (uint, error) {
		return 7, nil
	}

	middleware := OrgContext(checker, resolver)

	c, w := setupTestContext()
	c.Request.Header.Set("X-Org-ID", "org-uuid-1")
	c.Set("user_id", "user-uuid-1")

	middleware(c)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if c.IsAborted() {
		t.Error("request should not be aborted")
	}
	if GetOrgID(c) != "org-uuid-1" {
		t.Errorf("expected org_id 'org-uuid-1', got %q", GetOrgID(c))
	}
	if GetOrgDBID(c) != 42 {
		t.Errorf("expected org_db_id 42, got %d", GetOrgDBID(c))
	}
	if GetOrgRole(c) != "admin" {
		t.Errorf("expected org_role 'admin', got %q", GetOrgRole(c))
	}
}

func TestOrgContext_PlatformAdminBypass(t *testing.T) {
	checkerCalled := false
	checker := func(orgUUID string, userDBID uint) (uint, string, error) {
		checkerCalled = true
		// Return org DB ID but no membership role (admin bypass)
		return 42, "", nil
	}
	resolver := func(uuid string) (uint, error) {
		return 7, nil
	}

	middleware := OrgContext(checker, resolver)

	c, w := setupTestContext()
	c.Request.Header.Set("X-Org-ID", "org-uuid-1")
	c.Set("user_id", "user-uuid-1")
	c.Set("is_admin", true)

	middleware(c)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if !checkerCalled {
		t.Error("checker should still be called (to get org DB ID)")
	}
	if GetOrgRole(c) != "admin" {
		t.Errorf("platform admin should get 'admin' role, got %q", GetOrgRole(c))
	}
	if GetOrgDBID(c) != 42 {
		t.Errorf("expected org_db_id 42, got %d", GetOrgDBID(c))
	}
}

func TestIsOrgAdmin(t *testing.T) {
	tests := []struct {
		role     string
		expected bool
	}{
		{"admin", true},
		{"owner", true},
		{"member", false},
		{"", false},
	}

	for _, tt := range tests {
		c, _ := setupTestContext()
		c.Set(orgRoleKey, tt.role)
		if got := IsOrgAdmin(c); got != tt.expected {
			t.Errorf("IsOrgAdmin(%q) = %v, want %v", tt.role, got, tt.expected)
		}
	}
}

func TestGetOrgHelpers_DefaultValues(t *testing.T) {
	c, _ := setupTestContext()

	if GetOrgID(c) != "" {
		t.Errorf("expected empty string, got %q", GetOrgID(c))
	}
	if GetOrgDBID(c) != 0 {
		t.Errorf("expected 0, got %d", GetOrgDBID(c))
	}
	if GetOrgRole(c) != "" {
		t.Errorf("expected empty string, got %q", GetOrgRole(c))
	}
}
