package user

import (
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
