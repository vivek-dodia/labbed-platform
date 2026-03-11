package organization

import (
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/labbed/platform/internal/domain/user"
)

type OrgService struct {
	repo         *OrgRepository
	userService  *user.UserService
	resolveUser  func(uuid string) (*user.User, error)
	onOrgCreated func(orgDBID uint, creatorDBID uint) // called after a new org is created
}

func NewService(repo *OrgRepository, userService *user.UserService, resolveUser func(uuid string) (*user.User, error)) *OrgService {
	return &OrgService{
		repo:        repo,
		userService: userService,
		resolveUser: resolveUser,
	}
}

// SetOnOrgCreated registers a callback invoked after a new org is created (e.g. to seed sample data).
func (s *OrgService) SetOnOrgCreated(fn func(orgDBID uint, creatorDBID uint)) {
	s.onOrgCreated = fn
}

var slugRegex = regexp.MustCompile(`[^a-z0-9]+`)

func generateSlug(name string) string {
	slug := strings.ToLower(name)
	slug = slugRegex.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		slug = "org"
	}
	return slug
}

// Signup creates a new user and their personal organization.
func (s *OrgService) Signup(req SignupRequest) (*Response, string, error) {
	// Create user
	userResp, err := s.userService.CreateUser(user.CreateUserRequest{
		Email:    req.Email,
		Password: req.Password,
		DisplayName: req.Name,
	})
	if err != nil {
		return nil, "", fmt.Errorf("failed to create user: %w", err)
	}

	// Create personal org
	org := &Organization{
		UUID:       uuid.New().String(),
		Name:       req.OrgName,
		Slug:       generateSlug(req.OrgName) + "-" + userResp.UUID[:4],
		Plan:       "free",
		MaxLabs:    5,
		MaxWorkers: 2,
	}

	if err := s.repo.Create(org); err != nil {
		return nil, "", fmt.Errorf("failed to create organization: %w", err)
	}

	// Resolve user DB ID
	u, err := s.resolveUser(userResp.UUID)
	if err != nil {
		return nil, "", fmt.Errorf("failed to resolve user: %w", err)
	}

	// Add user as owner
	if err := s.repo.AddMember(&OrganizationMember{
		OrgID:  org.ID,
		UserID: u.ID,
		Role:   RoleOwner,
	}); err != nil {
		return nil, "", fmt.Errorf("failed to add owner: %w", err)
	}

	// Seed sample data for the new org
	if s.onOrgCreated != nil {
		s.onOrgCreated(org.ID, u.ID)
	}

	resp := s.buildResponse(org, RoleOwner)
	return &resp, userResp.UUID, nil
}

// Create creates a new organization and adds the creator as owner.
func (s *OrgService) Create(creatorDBID uint, req CreateRequest) (Response, error) {
	org := &Organization{
		UUID:       uuid.New().String(),
		Name:       req.Name,
		Slug:       generateSlug(req.Name) + "-" + uuid.New().String()[:4],
		Plan:       "free",
		MaxLabs:    5,
		MaxWorkers: 2,
	}

	if err := s.repo.Create(org); err != nil {
		return Response{}, fmt.Errorf("failed to create organization: %w", err)
	}

	if err := s.repo.AddMember(&OrganizationMember{
		OrgID:  org.ID,
		UserID: creatorDBID,
		Role:   RoleOwner,
	}); err != nil {
		return Response{}, fmt.Errorf("failed to add owner: %w", err)
	}

	// Seed sample data for the new org
	if s.onOrgCreated != nil {
		s.onOrgCreated(org.ID, creatorDBID)
	}

	return s.buildResponse(org, RoleOwner), nil
}

// GetByUUID returns an org by UUID.
func (s *OrgService) GetByUUID(orgUUID string) (Response, error) {
	org, err := s.repo.GetByUUID(orgUUID)
	if err != nil {
		return Response{}, errors.New("organization not found")
	}
	return s.buildResponse(org, ""), nil
}

// GetUserOrgs returns all orgs a user belongs to.
func (s *OrgService) GetUserOrgs(userDBID uint) ([]Response, error) {
	orgs, err := s.repo.GetOrgsByUserID(userDBID)
	if err != nil {
		return nil, err
	}

	responses := make([]Response, len(orgs))
	for i, org := range orgs {
		role, _ := s.repo.GetUserRole(org.ID, userDBID)
		responses[i] = s.buildResponse(&org, role)
	}
	return responses, nil
}

// GetDBID returns the database ID for an org UUID.
func (s *OrgService) GetDBID(orgUUID string) (uint, error) {
	org, err := s.repo.GetByUUID(orgUUID)
	if err != nil {
		return 0, err
	}
	return org.ID, nil
}

// IsMember checks if a user belongs to an org.
func (s *OrgService) IsMember(orgDBID, userDBID uint) (bool, OrgRole, error) {
	role, err := s.repo.GetUserRole(orgDBID, userDBID)
	if err != nil {
		return false, "", nil
	}
	return true, role, nil
}

// Update modifies an organization.
func (s *OrgService) Update(orgUUID string, req UpdateRequest) (Response, error) {
	org, err := s.repo.GetByUUID(orgUUID)
	if err != nil {
		return Response{}, errors.New("organization not found")
	}

	if req.Name != nil {
		org.Name = *req.Name
	}
	if req.Plan != nil {
		org.Plan = *req.Plan
	}
	if req.MaxLabs != nil {
		org.MaxLabs = *req.MaxLabs
	}
	if req.MaxWorkers != nil {
		org.MaxWorkers = *req.MaxWorkers
	}

	if err := s.repo.Update(org); err != nil {
		return Response{}, fmt.Errorf("failed to update organization: %w", err)
	}

	return s.buildResponse(org, ""), nil
}

// AddMember adds a user to an organization.
func (s *OrgService) AddMember(orgUUID string, userUUID string, role OrgRole) error {
	org, err := s.repo.GetByUUID(orgUUID)
	if err != nil {
		return errors.New("organization not found")
	}

	u, err := s.resolveUser(userUUID)
	if err != nil {
		return errors.New("user not found")
	}

	return s.repo.AddMember(&OrganizationMember{
		OrgID:  org.ID,
		UserID: u.ID,
		Role:   role,
	})
}

// RemoveMember removes a user from an organization.
func (s *OrgService) RemoveMember(orgUUID string, userUUID string) error {
	org, err := s.repo.GetByUUID(orgUUID)
	if err != nil {
		return errors.New("organization not found")
	}

	u, err := s.resolveUser(userUUID)
	if err != nil {
		return errors.New("user not found")
	}

	return s.repo.RemoveMember(org.ID, u.ID)
}

// GetMembers returns all members of an organization.
func (s *OrgService) GetMembers(orgUUID string, resolveUserUUID func(uint) (string, string, string, error)) ([]MemberResponse, error) {
	org, err := s.repo.GetByUUID(orgUUID)
	if err != nil {
		return nil, errors.New("organization not found")
	}

	members, err := s.repo.GetMembers(org.ID)
	if err != nil {
		return nil, err
	}

	responses := make([]MemberResponse, 0, len(members))
	for _, m := range members {
		userUUID, email, name, err := resolveUserUUID(m.UserID)
		if err != nil {
			continue
		}
		responses = append(responses, MemberResponse{
			UserID:   userUUID,
			Email:    email,
			Name:     name,
			Role:     m.Role,
			JoinedAt: m.CreatedAt,
		})
	}
	return responses, nil
}

// CheckLabQuota returns true if the org can create more labs.
func (s *OrgService) CheckLabQuota(orgDBID uint) (bool, error) {
	var o Organization
	if err := s.repo.db.First(&o, orgDBID).Error; err != nil {
		return false, err
	}
	count, err := s.repo.CountLabsByOrgID(orgDBID)
	if err != nil {
		return false, err
	}
	return int(count) < o.MaxLabs || o.MaxLabs == 0, nil
}

// CheckMembership validates if a user belongs to an org.
// Returns (orgDBID, role, error). Satisfies auth.OrgMembershipChecker.
func (s *OrgService) CheckMembership(orgUUID string, userDBID uint) (uint, string, error) {
	org, err := s.repo.GetByUUID(orgUUID)
	if err != nil {
		return 0, "", err
	}
	role, err := s.repo.GetUserRole(org.ID, userDBID)
	if err != nil {
		return org.ID, "", err
	}
	return org.ID, string(role), nil
}

func (s *OrgService) buildResponse(org *Organization, role OrgRole) Response {
	return Response{
		UUID:       org.UUID,
		Name:       org.Name,
		Slug:       org.Slug,
		Plan:       org.Plan,
		MaxLabs:    org.MaxLabs,
		MaxWorkers: org.MaxWorkers,
		Role:       role,
		CreatedAt:  org.CreatedAt,
	}
}
