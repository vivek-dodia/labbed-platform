package user

import (
	"errors"
	"log"

	"github.com/google/uuid"
	"github.com/labbed/platform/internal/auth"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserService struct {
	repo *UserRepository
}

func NewService(repo *UserRepository) *UserService {
	return &UserService{repo: repo}
}

func (s *UserService) Login(email, password string) (LoginResponse, error) {
	user, err := s.repo.GetByEmail(email)
	if err != nil {
		return LoginResponse{}, errors.New("invalid email or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return LoginResponse{}, errors.New("invalid email or password")
	}

	accessToken, err := auth.GenerateAccessToken(user.UUID, user.Email, user.IsAdmin)
	if err != nil {
		return LoginResponse{}, errors.New("failed to generate access token")
	}

	refreshToken, err := auth.GenerateRefreshToken(user.UUID, user.Email, user.IsAdmin)
	if err != nil {
		return LoginResponse{}, errors.New("failed to generate refresh token")
	}

	return LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user.ToResponse(),
	}, nil
}

func (s *UserService) RefreshToken(refreshToken string) (RefreshResponse, error) {
	claims, err := auth.ValidateToken(refreshToken, auth.RefreshToken)
	if err != nil {
		return RefreshResponse{}, errors.New("invalid or expired refresh token")
	}

	// Look up the user to get current admin status
	user, err := s.repo.GetByUUID(claims.UserID)
	if err != nil {
		return RefreshResponse{}, errors.New("user not found")
	}

	accessToken, err := auth.GenerateAccessToken(user.UUID, user.Email, user.IsAdmin)
	if err != nil {
		return RefreshResponse{}, errors.New("failed to generate access token")
	}

	return RefreshResponse{AccessToken: accessToken}, nil
}

func (s *UserService) CreateUser(req CreateUserRequest) (UserResponse, error) {
	// Check if email already exists
	if _, err := s.repo.GetByEmail(req.Email); err == nil {
		return UserResponse{}, errors.New("email already in use")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return UserResponse{}, errors.New("failed to hash password")
	}

	user := &User{
		UUID:         uuid.New().String(),
		Email:        req.Email,
		PasswordHash: string(hash),
		DisplayName:  req.DisplayName,
		IsAdmin:      req.IsAdmin,
	}

	if err := s.repo.Create(user); err != nil {
		return UserResponse{}, errors.New("failed to create user")
	}

	return user.ToResponse(), nil
}

func (s *UserService) GetUser(uuid string) (UserResponse, error) {
	user, err := s.repo.GetByUUID(uuid)
	if err != nil {
		return UserResponse{}, errors.New("user not found")
	}
	return user.ToResponse(), nil
}

func (s *UserService) GetAllUsers() ([]UserResponse, error) {
	users, err := s.repo.GetAll()
	if err != nil {
		return nil, errors.New("failed to retrieve users")
	}

	responses := make([]UserResponse, len(users))
	for i, u := range users {
		responses[i] = u.ToResponse()
	}
	return responses, nil
}

func (s *UserService) UpdateUser(uuid string, req UpdateUserRequest) (UserResponse, error) {
	user, err := s.repo.GetByUUID(uuid)
	if err != nil {
		return UserResponse{}, errors.New("user not found")
	}

	if req.DisplayName != nil {
		user.DisplayName = *req.DisplayName
	}
	if req.IsAdmin != nil {
		user.IsAdmin = *req.IsAdmin
	}

	if err := s.repo.Update(user); err != nil {
		return UserResponse{}, errors.New("failed to update user")
	}

	return user.ToResponse(), nil
}

func (s *UserService) DeleteUser(uuid string) error {
	user, err := s.repo.GetByUUID(uuid)
	if err != nil {
		return errors.New("user not found")
	}
	return s.repo.Delete(user)
}

func (s *UserService) ChangePassword(uuid, currentPassword, newPassword string, isSuperuser bool) error {
	user, err := s.repo.GetByUUID(uuid)
	if err != nil {
		return errors.New("user not found")
	}

	// Superusers (admins) can change passwords without knowing the current one
	if !isSuperuser {
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
			return errors.New("current password is incorrect")
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return errors.New("failed to hash password")
	}

	user.PasswordHash = string(hash)
	return s.repo.Update(user)
}

// FindOrCreateByGoogle finds a user by Google subject ID, or creates one.
// If a user with matching email exists but no sub, it links the Google account.
// Returns the user and whether it was newly created.
func (s *UserService) FindOrCreateByGoogle(sub, email, name string) (*User, bool, error) {
	// Try by sub first
	if u, err := s.repo.GetBySub(sub); err == nil {
		return u, false, nil
	}

	// Try by email — link existing account
	if u, err := s.repo.GetByEmail(email); err == nil {
		u.Sub = sub
		if err := s.repo.Update(u); err != nil {
			return nil, false, errors.New("failed to link google account")
		}
		return u, false, nil
	}

	// Create new user (no password — Google-only)
	u := &User{
		UUID:        uuid.New().String(),
		Email:       email,
		DisplayName: name,
		Sub:         sub,
	}
	if err := s.repo.Create(u); err != nil {
		return nil, false, errors.New("failed to create user")
	}
	return u, true, nil
}

func (s *UserService) EnsureAdminExists(email, password string) *User {
	if existing, err := s.repo.GetByEmail(email); err == nil {
		return existing
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		log.Printf("Warning: failed to check for admin user: %v", err)
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Warning: failed to hash admin password: %v", err)
		return nil
	}

	admin := &User{
		UUID:         uuid.New().String(),
		Email:        email,
		PasswordHash: string(hash),
		DisplayName:  "Admin",
		IsAdmin:      true,
	}

	if err := s.repo.Create(admin); err != nil {
		log.Printf("Warning: failed to create admin user: %v", err)
		return nil
	}

	log.Printf("Default admin user created: %s", email)
	return admin
}
