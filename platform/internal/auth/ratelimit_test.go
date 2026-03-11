package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestRateLimit_AllowsUnderLimit(t *testing.T) {
	router := gin.New()
	router.Use(RateLimit(5, time.Minute))
	router.GET("/test", func(c *gin.Context) { c.Status(200) })

	for i := 0; i < 5; i++ {
		w := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/test", nil)
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("request %d: expected 200, got %d", i+1, w.Code)
		}
	}
}

func TestRateLimit_BlocksOverLimit(t *testing.T) {
	router := gin.New()
	router.Use(RateLimit(3, time.Minute))
	router.GET("/test", func(c *gin.Context) { c.Status(200) })

	// First 3 should pass
	for i := 0; i < 3; i++ {
		w := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/test", nil)
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("request %d: expected 200, got %d", i+1, w.Code)
		}
	}

	// 4th should be blocked
	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429, got %d", w.Code)
	}
}

func TestRateLimit_WindowExpiry(t *testing.T) {
	rl := newRateLimiter(2, 50*time.Millisecond)

	if !rl.allow("test-ip") {
		t.Error("first request should be allowed")
	}
	if !rl.allow("test-ip") {
		t.Error("second request should be allowed")
	}
	if rl.allow("test-ip") {
		t.Error("third request should be blocked")
	}

	// Wait for window to expire
	time.Sleep(60 * time.Millisecond)

	if !rl.allow("test-ip") {
		t.Error("request after window expiry should be allowed")
	}
}
