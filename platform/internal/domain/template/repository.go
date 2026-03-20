package template

import (
	"gorm.io/gorm"
)

type TemplateRepository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *TemplateRepository {
	return &TemplateRepository{db: db}
}

func (r *TemplateRepository) Create(tmpl *Template) error {
	return r.db.Create(tmpl).Error
}

func (r *TemplateRepository) GetByUUID(uuid string) (*Template, error) {
	var tmpl Template
	if err := r.db.Where("uuid = ?", uuid).First(&tmpl).Error; err != nil {
		return nil, err
	}
	return &tmpl, nil
}

func (r *TemplateRepository) GetAll() ([]Template, error) {
	var templates []Template
	if err := r.db.Find(&templates).Error; err != nil {
		return nil, err
	}
	return templates, nil
}

func (r *TemplateRepository) GetAllByOrgID(orgID uint) ([]Template, error) {
	var templates []Template
	if err := r.db.Where("org_id = ?", orgID).Find(&templates).Error; err != nil {
		return nil, err
	}
	return templates, nil
}

func (r *TemplateRepository) GetByCollectionIDs(collectionIDs []uint) ([]Template, error) {
	var templates []Template
	if err := r.db.Where("collection_id IN ?", collectionIDs).Find(&templates).Error; err != nil {
		return nil, err
	}
	return templates, nil
}

func (r *TemplateRepository) Update(tmpl *Template) error {
	return r.db.Save(tmpl).Error
}

func (r *TemplateRepository) Delete(id uint) error {
	return r.db.Delete(&Template{}, id).Error
}

func (r *TemplateRepository) CreateBindFile(file *BindFile) error {
	return r.db.Create(file).Error
}

func (r *TemplateRepository) GetBindFileByUUID(uuid string) (*BindFile, error) {
	var file BindFile
	if err := r.db.Where("uuid = ?", uuid).First(&file).Error; err != nil {
		return nil, err
	}
	return &file, nil
}

func (r *TemplateRepository) GetBindFilesByTemplateID(templateID uint) ([]BindFile, error) {
	var files []BindFile
	if err := r.db.Where("template_id = ?", templateID).Find(&files).Error; err != nil {
		return nil, err
	}
	return files, nil
}

func (r *TemplateRepository) UpdateBindFile(file *BindFile) error {
	return r.db.Save(file).Error
}

func (r *TemplateRepository) DeleteBindFile(id uint) error {
	return r.db.Delete(&BindFile{}, id).Error
}
