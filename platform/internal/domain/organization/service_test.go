package organization

import (
	"testing"

	"github.com/labbed/platform/internal/domain/user"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	// Migrate org models + labs table (needed for quota check)
	if err := db.AutoMigrate(&user.User{}, &Organization{}, &OrganizationMember{}); err != nil {
		t.Fatalf("failed to migrate: %v", err)
	}
	// Create labs table for quota checks
	db.Exec("CREATE TABLE IF NOT EXISTS labs (id INTEGER PRIMARY KEY, org_id INTEGER DEFAULT 0, state TEXT DEFAULT 'scheduled', deleted_at DATETIME)")
	return db
}

func setupService(t *testing.T) (*OrgService, *gorm.DB) {
	t.Helper()
	db := setupTestDB(t)
	userRepo := user.NewRepository(db)
	userService := user.NewService(userRepo)
	orgRepo := NewRepository(db)

	resolveUser := func(uuid string) (*user.User, error) {
		return userRepo.GetByUUID(uuid)
	}

	svc := NewService(orgRepo, userService, resolveUser)
	return svc, db
}

func TestSignup(t *testing.T) {
	svc, _ := setupService(t)

	resp, userUUID, err := svc.Signup(SignupRequest{
		Email:    "test@example.com",
		Password: "password123",
		Name:     "Test User",
		OrgName:  "Test Org",
	})
	if err != nil {
		t.Fatalf("signup failed: %v", err)
	}
	if resp == nil {
		t.Fatal("expected non-nil response")
	}
	if resp.Name != "Test Org" {
		t.Errorf("expected org name 'Test Org', got %q", resp.Name)
	}
	if resp.Role != RoleOwner {
		t.Errorf("expected role 'owner', got %q", resp.Role)
	}
	if userUUID == "" {
		t.Error("expected non-empty user UUID")
	}
	if resp.Plan != "free" {
		t.Errorf("expected plan 'free', got %q", resp.Plan)
	}
}

func TestSignup_DuplicateEmail(t *testing.T) {
	svc, _ := setupService(t)

	_, _, err := svc.Signup(SignupRequest{
		Email:    "dup@example.com",
		Password: "password123",
		Name:     "User One",
		OrgName:  "Org One",
	})
	if err != nil {
		t.Fatalf("first signup failed: %v", err)
	}

	_, _, err = svc.Signup(SignupRequest{
		Email:    "dup@example.com",
		Password: "password123",
		Name:     "User Two",
		OrgName:  "Org Two",
	})
	if err == nil {
		t.Error("expected error for duplicate email")
	}
}

func TestCreate(t *testing.T) {
	svc, db := setupService(t)

	// Create a user first
	u := &user.User{UUID: "user-1", Email: "creator@test.com", PasswordHash: "x", DisplayName: "Creator"}
	db.Create(u)

	resp, err := svc.Create(u.ID, CreateRequest{Name: "My Org"})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	if resp.Name != "My Org" {
		t.Errorf("expected 'My Org', got %q", resp.Name)
	}
	if resp.Role != RoleOwner {
		t.Errorf("expected 'owner', got %q", resp.Role)
	}
}

func TestGetUserOrgs(t *testing.T) {
	svc, db := setupService(t)

	u := &user.User{UUID: "user-1", Email: "multi@test.com", PasswordHash: "x", DisplayName: "Multi"}
	db.Create(u)

	_, err := svc.Create(u.ID, CreateRequest{Name: "Org A"})
	if err != nil {
		t.Fatalf("create org A failed: %v", err)
	}
	_, err = svc.Create(u.ID, CreateRequest{Name: "Org B"})
	if err != nil {
		t.Fatalf("create org B failed: %v", err)
	}

	orgs, err := svc.GetUserOrgs(u.ID)
	if err != nil {
		t.Fatalf("get user orgs failed: %v", err)
	}
	if len(orgs) != 2 {
		t.Errorf("expected 2 orgs, got %d", len(orgs))
	}
}

func TestIsMember(t *testing.T) {
	svc, db := setupService(t)

	u1 := &user.User{UUID: "u1", Email: "member@test.com", PasswordHash: "x", DisplayName: "Member"}
	u2 := &user.User{UUID: "u2", Email: "outsider@test.com", PasswordHash: "x", DisplayName: "Outsider"}
	db.Create(u1)
	db.Create(u2)

	resp, err := svc.Create(u1.ID, CreateRequest{Name: "Private Org"})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	orgDBID, err := svc.GetDBID(resp.UUID)
	if err != nil {
		t.Fatalf("get db id failed: %v", err)
	}

	// u1 should be a member
	isMember, role, err := svc.IsMember(orgDBID, u1.ID)
	if err != nil {
		t.Fatalf("IsMember failed: %v", err)
	}
	if !isMember {
		t.Error("u1 should be a member")
	}
	if role != RoleOwner {
		t.Errorf("expected 'owner', got %q", role)
	}

	// u2 should NOT be a member
	isMember, _, _ = svc.IsMember(orgDBID, u2.ID)
	if isMember {
		t.Error("u2 should not be a member")
	}
}

func TestCheckMembership(t *testing.T) {
	svc, db := setupService(t)

	u := &user.User{UUID: "u-check", Email: "check@test.com", PasswordHash: "x", DisplayName: "Check"}
	db.Create(u)

	resp, _ := svc.Create(u.ID, CreateRequest{Name: "Check Org"})

	// Valid membership
	orgDBID, role, err := svc.CheckMembership(resp.UUID, u.ID)
	if err != nil {
		t.Fatalf("check membership failed: %v", err)
	}
	if orgDBID == 0 {
		t.Error("expected non-zero orgDBID")
	}
	if role != "owner" {
		t.Errorf("expected 'owner', got %q", role)
	}

	// Invalid org UUID
	_, _, err = svc.CheckMembership("nonexistent-uuid", u.ID)
	if err == nil {
		t.Error("expected error for nonexistent org")
	}
}

func TestAddAndRemoveMember(t *testing.T) {
	svc, db := setupService(t)

	owner := &user.User{UUID: "owner-1", Email: "owner@test.com", PasswordHash: "x", DisplayName: "Owner"}
	member := &user.User{UUID: "member-1", Email: "member2@test.com", PasswordHash: "x", DisplayName: "Member"}
	db.Create(owner)
	db.Create(member)

	resp, _ := svc.Create(owner.ID, CreateRequest{Name: "Team Org"})

	// Add member
	err := svc.AddMember(resp.UUID, member.UUID, RoleMember)
	if err != nil {
		t.Fatalf("add member failed: %v", err)
	}

	// Verify membership
	orgDBID, _ := svc.GetDBID(resp.UUID)
	isMember, role, _ := svc.IsMember(orgDBID, member.ID)
	if !isMember {
		t.Error("member should be in org")
	}
	if role != RoleMember {
		t.Errorf("expected 'member', got %q", role)
	}

	// Remove member
	err = svc.RemoveMember(resp.UUID, member.UUID)
	if err != nil {
		t.Fatalf("remove member failed: %v", err)
	}

	// Verify removed
	isMember, _, _ = svc.IsMember(orgDBID, member.ID)
	if isMember {
		t.Error("member should no longer be in org")
	}
}

func TestGetMembers(t *testing.T) {
	svc, db := setupService(t)

	owner := &user.User{UUID: "gm-owner", Email: "gm-owner@test.com", PasswordHash: "x", DisplayName: "GM Owner"}
	member := &user.User{UUID: "gm-member", Email: "gm-member@test.com", PasswordHash: "x", DisplayName: "GM Member"}
	db.Create(owner)
	db.Create(member)

	resp, _ := svc.Create(owner.ID, CreateRequest{Name: "Members Org"})
	_ = svc.AddMember(resp.UUID, member.UUID, RoleMember)

	resolveInfo := func(id uint) (string, string, string, error) {
		var u user.User
		if err := db.First(&u, id).Error; err != nil {
			return "", "", "", err
		}
		return u.UUID, u.Email, u.DisplayName, nil
	}

	members, err := svc.GetMembers(resp.UUID, resolveInfo)
	if err != nil {
		t.Fatalf("get members failed: %v", err)
	}
	if len(members) != 2 {
		t.Errorf("expected 2 members, got %d", len(members))
	}
}

func TestUpdate(t *testing.T) {
	svc, db := setupService(t)

	u := &user.User{UUID: "u-upd", Email: "upd@test.com", PasswordHash: "x", DisplayName: "Upd"}
	db.Create(u)

	resp, _ := svc.Create(u.ID, CreateRequest{Name: "Update Me"})

	newName := "Updated Org"
	newPlan := "team"
	updated, err := svc.Update(resp.UUID, UpdateRequest{
		Name: &newName,
		Plan: &newPlan,
	})
	if err != nil {
		t.Fatalf("update failed: %v", err)
	}
	if updated.Name != "Updated Org" {
		t.Errorf("expected 'Updated Org', got %q", updated.Name)
	}
	if updated.Plan != "team" {
		t.Errorf("expected 'team', got %q", updated.Plan)
	}
}

func TestCheckLabQuota(t *testing.T) {
	svc, db := setupService(t)

	u := &user.User{UUID: "u-quota", Email: "quota@test.com", PasswordHash: "x", DisplayName: "Quota"}
	db.Create(u)

	resp, _ := svc.Create(u.ID, CreateRequest{Name: "Quota Org"})
	orgDBID, _ := svc.GetDBID(resp.UUID)

	// Default maxLabs is 5, no labs exist
	allowed, err := svc.CheckLabQuota(orgDBID)
	if err != nil {
		t.Fatalf("check quota failed: %v", err)
	}
	if !allowed {
		t.Error("should be allowed (0 < 5)")
	}
}

func TestSlugGeneration(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"My Org", "my-org"},
		{"Test 123!", "test-123"},
		{"  spaces  ", "spaces"},
		{"UPPER", "upper"},
		{"", "org"},
		{"---", "org"},
	}

	for _, tt := range tests {
		got := generateSlug(tt.input)
		if got != tt.expected {
			t.Errorf("generateSlug(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}
