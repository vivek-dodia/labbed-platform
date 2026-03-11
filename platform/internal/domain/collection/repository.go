package collection

import (
	"gorm.io/gorm"
)

type CollectionRepository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *CollectionRepository {
	return &CollectionRepository{db: db}
}

func (r *CollectionRepository) Create(collection *Collection) error {
	return r.db.Create(collection).Error
}

func (r *CollectionRepository) GetByUUID(uuid string) (*Collection, error) {
	var col Collection
	if err := r.db.Where("uuid = ?", uuid).First(&col).Error; err != nil {
		return nil, err
	}
	return &col, nil
}

func (r *CollectionRepository) GetAll() ([]Collection, error) {
	var collections []Collection
	if err := r.db.Find(&collections).Error; err != nil {
		return nil, err
	}
	return collections, nil
}

func (r *CollectionRepository) GetAllByOrgID(orgID uint) ([]Collection, error) {
	var collections []Collection
	if err := r.db.Where("org_id = ?", orgID).Find(&collections).Error; err != nil {
		return nil, err
	}
	return collections, nil
}

func (r *CollectionRepository) GetByUserID(userID uint) ([]Collection, error) {
	var collections []Collection
	err := r.db.
		Distinct().
		Joins("LEFT JOIN collection_members ON collection_members.collection_id = collections.id AND collection_members.deleted_at IS NULL").
		Where("collection_members.user_id = ? OR collections.public_read = ?", userID, true).
		Find(&collections).Error
	if err != nil {
		return nil, err
	}
	return collections, nil
}

func (r *CollectionRepository) GetByUserIDAndOrgID(userID, orgID uint) ([]Collection, error) {
	var collections []Collection
	err := r.db.
		Distinct().
		Joins("LEFT JOIN collection_members ON collection_members.collection_id = collections.id AND collection_members.deleted_at IS NULL").
		Where("collections.org_id = ? AND (collection_members.user_id = ? OR collections.public_read = ?)", orgID, userID, true).
		Find(&collections).Error
	if err != nil {
		return nil, err
	}
	return collections, nil
}

func (r *CollectionRepository) Update(collection *Collection) error {
	return r.db.Save(collection).Error
}

func (r *CollectionRepository) Delete(id uint) error {
	return r.db.Delete(&Collection{}, id).Error
}

func (r *CollectionRepository) AddMember(member *CollectionMember) error {
	return r.db.Create(member).Error
}

func (r *CollectionRepository) RemoveMember(collectionID, userID uint) error {
	return r.db.
		Where("collection_id = ? AND user_id = ?", collectionID, userID).
		Delete(&CollectionMember{}).Error
}

func (r *CollectionRepository) GetMembers(collectionID uint) ([]CollectionMember, error) {
	var members []CollectionMember
	if err := r.db.Where("collection_id = ?", collectionID).Find(&members).Error; err != nil {
		return nil, err
	}
	return members, nil
}

func (r *CollectionRepository) IsUserMember(collectionID, userID uint) (bool, string, error) {
	var member CollectionMember
	err := r.db.
		Where("collection_id = ? AND user_id = ?", collectionID, userID).
		First(&member).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return false, "", nil
		}
		return false, "", err
	}
	return true, member.Role, nil
}
