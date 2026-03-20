package user

import (
	"time"

	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(user *User) error {
	return r.db.Create(user).Error
}

func (r *UserRepository) GetByID(id uint) (*User, error) {
	var user User
	if err := r.db.First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetByUUID(uuid string) (*User, error) {
	var user User
	if err := r.db.Where("uuid = ?", uuid).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetByEmail(email string) (*User, error) {
	var user User
	if err := r.db.Where("email = ?", email).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetBySub(sub string) (*User, error) {
	var user User
	if err := r.db.Where("sub = ?", sub).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetAll() ([]User, error) {
	var users []User
	if err := r.db.Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func (r *UserRepository) Update(user *User) error {
	return r.db.Save(user).Error
}

func (r *UserRepository) Delete(user *User) error {
	return r.db.Delete(user).Error
}

// TouchLastActive updates the user's last_active timestamp.
func (r *UserRepository) TouchLastActive(uuid string) {
	now := time.Now()
	r.db.Model(&User{}).Where("uuid = ?", uuid).Update("last_active", &now)
}

// GetInactiveUsersWithRunningLabs returns user IDs that have running/deploying labs
// but haven't been active since the given threshold.
func (r *UserRepository) GetInactiveUsersWithRunningLabs(threshold time.Time) ([]uint, error) {
	var userIDs []uint
	err := r.db.Raw(`
		SELECT DISTINCT u.id FROM users u
		INNER JOIN labs l ON l.creator_id = u.id
		WHERE l.state IN ('running', 'deploying')
		AND (u.last_active IS NULL OR u.last_active < ?)
		AND u.deleted_at IS NULL AND l.deleted_at IS NULL
	`, threshold).Scan(&userIDs).Error
	return userIDs, err
}
