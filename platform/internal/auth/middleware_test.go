package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/labbed/platform/internal/config"
)

func init() {
	gin.SetMode(gin.TestMode)
	config.AppConfig.Auth.JWTSecret = "test-secret"
	config.AppConfig.Auth.AccessTokenExpiry = 30 * time.Minute
	config.AppConfig.Auth.RefreshTokenExpiry = 720 * time.Hour
}

func TestAuthRequired_MissingHeader(t *testing.T) {
	router := gin.New()
	router.Use(AuthRequired())
	router.GET("/test", func(c *gin.Context) { c.Status(200) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthRequired_InvalidFormat(t *testing.T) {
	router := gin.New()
	router.Use(AuthRequired())
	router.GET("/test", func(c *gin.Context) { c.Status(200) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "NotBearer token")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthRequired_InvalidToken(t *testing.T) {
	router := gin.New()
	router.Use(AuthRequired())
	router.GET("/test", func(c *gin.Context) { c.Status(200) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer invalid-jwt-token")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthRequired_ValidToken(t *testing.T) {
	token, err := GenerateAccessToken("user-uuid-1", "test@example.com", false)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	var capturedUserID string
	var capturedIsAdmin bool

	router := gin.New()
	router.Use(AuthRequired())
	router.GET("/test", func(c *gin.Context) {
		capturedUserID = GetUserID(c)
		capturedIsAdmin = IsAdmin(c)
		c.Status(200)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if capturedUserID != "user-uuid-1" {
		t.Errorf("expected user_id 'user-uuid-1', got %q", capturedUserID)
	}
	if capturedIsAdmin {
		t.Error("expected isAdmin to be false")
	}
}

func TestAuthRequired_AdminToken(t *testing.T) {
	token, _ := GenerateAccessToken("admin-uuid", "admin@example.com", true)

	var capturedIsAdmin bool

	router := gin.New()
	router.Use(AuthRequired())
	router.GET("/test", func(c *gin.Context) {
		capturedIsAdmin = IsAdmin(c)
		c.Status(200)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if !capturedIsAdmin {
		t.Error("expected isAdmin to be true")
	}
}

func TestAuthRequired_RefreshTokenRejected(t *testing.T) {
	token, _ := GenerateRefreshToken("user-uuid", "test@example.com", false)

	router := gin.New()
	router.Use(AuthRequired())
	router.GET("/test", func(c *gin.Context) { c.Status(200) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for refresh token, got %d", w.Code)
	}
}

func TestAdminRequired_NotAdmin(t *testing.T) {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-uuid")
		c.Set("is_admin", false)
		c.Next()
	})
	router.Use(AdminRequired())
	router.GET("/test", func(c *gin.Context) { c.Status(200) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestAdminRequired_IsAdmin(t *testing.T) {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "admin-uuid")
		c.Set("is_admin", true)
		c.Next()
	})
	router.Use(AdminRequired())
	router.GET("/test", func(c *gin.Context) { c.Status(200) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestWorkerAuth_ValidSecret(t *testing.T) {
	router := gin.New()
	router.Use(WorkerAuth("test-worker-secret"))
	router.POST("/test", func(c *gin.Context) { c.Status(200) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/test", nil)
	req.Header.Set("X-Worker-Secret", "test-worker-secret")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestWorkerAuth_InvalidSecret(t *testing.T) {
	router := gin.New()
	router.Use(WorkerAuth("test-worker-secret"))
	router.POST("/test", func(c *gin.Context) { c.Status(200) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/test", nil)
	req.Header.Set("X-Worker-Secret", "wrong-secret")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestWorkerAuth_MissingSecret(t *testing.T) {
	router := gin.New()
	router.Use(WorkerAuth("test-worker-secret"))
	router.POST("/test", func(c *gin.Context) { c.Status(200) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}
