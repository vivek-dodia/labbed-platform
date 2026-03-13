package nosimage

import "gorm.io/gorm"

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(img *NosImage) error {
	return r.db.Create(img).Error
}

func (r *Repository) GetByUUID(uuid string) (*NosImage, error) {
	var img NosImage
	if err := r.db.Where("uuid = ?", uuid).First(&img).Error; err != nil {
		return nil, err
	}
	return &img, nil
}

// GetAvailable returns system images (org_id=0) plus org-specific images.
func (r *Repository) GetAvailable(orgID uint) ([]NosImage, error) {
	var images []NosImage
	err := r.db.Where("org_id = 0 OR org_id = ?", orgID).Order("is_system DESC, name ASC").Find(&images).Error
	return images, err
}

func (r *Repository) Delete(img *NosImage) error {
	return r.db.Unscoped().Delete(img).Error
}
