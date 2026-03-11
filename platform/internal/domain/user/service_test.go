package user

import (
	"testing"
	"time"

	"github.com/labbed/platform/internal/config"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func init() {
	config.AppConfig.Auth.JWTSecret = "test-secret"
	config.AppConfig.Auth.AccessTokenExpiry = 30 * time.Minute
	config.AppConfig.Auth.RefreshTokenExpiry = 720 * time.Hour
}

func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	if err := db.AutoMigrate(&User{}); err != nil {
		t.Fatalf("failed to migrate: %v", err)
	}
	return db
}

func setupUserService(t *testing.T) *UserService {
	t.Helper()
	db := setupTestDB(t)
	repo := NewRepository(db)
	return NewService(repo)
}

func TestCreateUser(t *testing.T) {
	svc := setupUserService(t)

	resp, err := svc.CreateUser(CreateUserRequest{
		Email:       "test@example.com",
		Password:    "password123",
		DisplayName: "Test User",
	})
	if err != nil {
		t.Fatalf("create user failed: %v", err)
	}
	if resp.Email != "test@example.com" {
		t.Errorf("expected email 'test@example.com', got %q", resp.Email)
	}
	if resp.DisplayName != "Test User" {
		t.Errorf("expected display name 'Test User', got %q", resp.DisplayName)
	}
	if resp.UUID == "" {
		t.Error("expected non-empty UUID")
	}
}

func TestCreateUser_DuplicateEmail(t *testing.T) {
	svc := setupUserService(t)

	_, err := svc.CreateUser(CreateUserRequest{
		Email:       "dup@example.com",
		Password:    "password123",
		DisplayName: "User One",
	})
	if err != nil {
		t.Fatalf("first create failed: %v", err)
	}

	_, err = svc.CreateUser(CreateUserRequest{
		Email:       "dup@example.com",
		Password:    "password123",
		DisplayName: "User Two",
	})
	if err == nil {
		t.Error("expected error for duplicate email")
	}
}

func TestLogin(t *testing.T) {
	svc := setupUserService(t)

	_, err := svc.CreateUser(CreateUserRequest{
		Email:       "login@example.com",
		Password:    "password123",
		DisplayName: "Login User",
	})
	if err != nil {
		t.Fatalf("create user failed: %v", err)
	}

	resp, err := svc.Login("login@example.com", "password123")
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}
	if resp.AccessToken == "" {
		t.Error("expected non-empty access token")
	}
	if resp.RefreshToken == "" {
		t.Error("expected non-empty refresh token")
	}
	if resp.User.Email != "login@example.com" {
		t.Errorf("expected email 'login@example.com', got %q", resp.User.Email)
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	svc := setupUserService(t)

	_, _ = svc.CreateUser(CreateUserRequest{
		Email:       "wrong@example.com",
		Password:    "password123",
		DisplayName: "User",
	})

	_, err := svc.Login("wrong@example.com", "wrongpassword")
	if err == nil {
		t.Error("expected error for wrong password")
	}
}

func TestLogin_NonexistentUser(t *testing.T) {
	svc := setupUserService(t)

	_, err := svc.Login("noone@example.com", "password123")
	if err == nil {
		t.Error("expected error for nonexistent user")
	}
}

func TestRefreshToken(t *testing.T) {
	svc := setupUserService(t)

	_, _ = svc.CreateUser(CreateUserRequest{
		Email:       "refresh@example.com",
		Password:    "password123",
		DisplayName: "Refresh User",
	})

	loginResp, _ := svc.Login("refresh@example.com", "password123")

	refreshResp, err := svc.RefreshToken(loginResp.RefreshToken)
	if err != nil {
		t.Fatalf("refresh failed: %v", err)
	}
	if refreshResp.AccessToken == "" {
		t.Error("expected non-empty access token")
	}
}

func TestRefreshToken_InvalidToken(t *testing.T) {
	svc := setupUserService(t)

	_, err := svc.RefreshToken("invalid-token")
	if err == nil {
		t.Error("expected error for invalid refresh token")
	}
}

func TestRefreshToken_AccessTokenRejected(t *testing.T) {
	svc := setupUserService(t)

	_, _ = svc.CreateUser(CreateUserRequest{
		Email:       "tokentype@example.com",
		Password:    "password123",
		DisplayName: "Token Type User",
	})

	loginResp, _ := svc.Login("tokentype@example.com", "password123")

	// Using access token as refresh token should fail
	_, err := svc.RefreshToken(loginResp.AccessToken)
	if err == nil {
		t.Error("expected error when using access token as refresh token")
	}
}

func TestChangePassword(t *testing.T) {
	svc := setupUserService(t)

	resp, _ := svc.CreateUser(CreateUserRequest{
		Email:       "changepw@example.com",
		Password:    "oldpassword",
		DisplayName: "PW User",
	})

	// Change with correct current password
	err := svc.ChangePassword(resp.UUID, "oldpassword", "newpassword", false)
	if err != nil {
		t.Fatalf("change password failed: %v", err)
	}

	// Login with new password
	_, err = svc.Login("changepw@example.com", "newpassword")
	if err != nil {
		t.Error("login with new password should succeed")
	}

	// Login with old password should fail
	_, err = svc.Login("changepw@example.com", "oldpassword")
	if err == nil {
		t.Error("login with old password should fail")
	}
}

func TestChangePassword_WrongCurrent(t *testing.T) {
	svc := setupUserService(t)

	resp, _ := svc.CreateUser(CreateUserRequest{
		Email:       "wrongcur@example.com",
		Password:    "password123",
		DisplayName: "User",
	})

	err := svc.ChangePassword(resp.UUID, "wrongcurrent", "newpassword", false)
	if err == nil {
		t.Error("expected error for wrong current password")
	}
}

func TestChangePassword_SuperuserBypass(t *testing.T) {
	svc := setupUserService(t)

	resp, _ := svc.CreateUser(CreateUserRequest{
		Email:       "superuser@example.com",
		Password:    "password123",
		DisplayName: "User",
	})

	// Superuser can change without knowing current password
	err := svc.ChangePassword(resp.UUID, "", "newpassword", true)
	if err != nil {
		t.Fatalf("superuser change password failed: %v", err)
	}
}

func TestGetUser(t *testing.T) {
	svc := setupUserService(t)

	created, _ := svc.CreateUser(CreateUserRequest{
		Email:       "get@example.com",
		Password:    "password123",
		DisplayName: "Get User",
	})

	resp, err := svc.GetUser(created.UUID)
	if err != nil {
		t.Fatalf("get user failed: %v", err)
	}
	if resp.UUID != created.UUID {
		t.Errorf("expected UUID %q, got %q", created.UUID, resp.UUID)
	}
}

func TestGetUser_NotFound(t *testing.T) {
	svc := setupUserService(t)

	_, err := svc.GetUser("nonexistent-uuid")
	if err == nil {
		t.Error("expected error for nonexistent user")
	}
}

func TestUpdateUser(t *testing.T) {
	svc := setupUserService(t)

	created, _ := svc.CreateUser(CreateUserRequest{
		Email:       "update@example.com",
		Password:    "password123",
		DisplayName: "Original Name",
	})

	newName := "Updated Name"
	isAdmin := true
	resp, err := svc.UpdateUser(created.UUID, UpdateUserRequest{
		DisplayName: &newName,
		IsAdmin:     &isAdmin,
	})
	if err != nil {
		t.Fatalf("update user failed: %v", err)
	}
	if resp.DisplayName != "Updated Name" {
		t.Errorf("expected 'Updated Name', got %q", resp.DisplayName)
	}
	if !resp.IsAdmin {
		t.Error("expected isAdmin to be true")
	}
}

func TestDeleteUser(t *testing.T) {
	svc := setupUserService(t)

	created, _ := svc.CreateUser(CreateUserRequest{
		Email:       "delete@example.com",
		Password:    "password123",
		DisplayName: "Delete Me",
	})

	err := svc.DeleteUser(created.UUID)
	if err != nil {
		t.Fatalf("delete user failed: %v", err)
	}

	_, err = svc.GetUser(created.UUID)
	if err == nil {
		t.Error("expected error after deletion")
	}
}

func TestFindOrCreateByGoogle_NewUser(t *testing.T) {
	svc := setupUserService(t)

	u, isNew, err := svc.FindOrCreateByGoogle("google-sub-123", "google@example.com", "Google User")
	if err != nil {
		t.Fatalf("find or create failed: %v", err)
	}
	if !isNew {
		t.Error("expected isNew to be true")
	}
	if u.Sub != "google-sub-123" {
		t.Errorf("expected sub 'google-sub-123', got %q", u.Sub)
	}
	if u.Email != "google@example.com" {
		t.Errorf("expected email 'google@example.com', got %q", u.Email)
	}
	if u.PasswordHash != "" {
		t.Error("google-only user should have no password hash")
	}
}

func TestFindOrCreateByGoogle_ExistingSub(t *testing.T) {
	svc := setupUserService(t)

	// Create first
	_, _, _ = svc.FindOrCreateByGoogle("google-sub-456", "existing@example.com", "Existing User")

	// Find by sub
	u, isNew, err := svc.FindOrCreateByGoogle("google-sub-456", "existing@example.com", "Existing User")
	if err != nil {
		t.Fatalf("find failed: %v", err)
	}
	if isNew {
		t.Error("expected isNew to be false")
	}
	if u.Email != "existing@example.com" {
		t.Errorf("expected email 'existing@example.com', got %q", u.Email)
	}
}

func TestFindOrCreateByGoogle_LinkByEmail(t *testing.T) {
	svc := setupUserService(t)

	// Create native user first
	_, _ = svc.CreateUser(CreateUserRequest{
		Email:       "link@example.com",
		Password:    "password123",
		DisplayName: "Native User",
	})

	// Google login with same email should link
	u, isNew, err := svc.FindOrCreateByGoogle("google-sub-link", "link@example.com", "Native User")
	if err != nil {
		t.Fatalf("link failed: %v", err)
	}
	if isNew {
		t.Error("expected isNew to be false (linked existing)")
	}
	if u.Sub != "google-sub-link" {
		t.Errorf("expected sub to be set, got %q", u.Sub)
	}
	// Should still be able to login with password
	_, err = svc.Login("link@example.com", "password123")
	if err != nil {
		t.Error("native login should still work after linking")
	}
}

func TestEnsureAdminExists(t *testing.T) {
	svc := setupUserService(t)

	admin := svc.EnsureAdminExists("admin@test.com", "adminpass")
	if admin == nil {
		t.Fatal("expected admin to be created")
	}
	if !admin.IsAdmin {
		t.Error("expected admin flag to be true")
	}

	// Calling again should return existing
	admin2 := svc.EnsureAdminExists("admin@test.com", "adminpass")
	if admin2 == nil {
		t.Fatal("expected existing admin to be returned")
	}
	if admin2.ID != admin.ID {
		t.Error("expected same admin user")
	}
}
