package organization

import (
	"gorm.io/gorm"
)

type OrgRepository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *OrgRepository {
	return &OrgRepository{db: db}
}

func (r *OrgRepository) Create(org *Organization) error {
	return r.db.Create(org).Error
}

func (r *OrgRepository) GetByUUID(uuid string) (*Organization, error) {
	var org Organization
	if err := r.db.Where("uuid = ?", uuid).First(&org).Error; err != nil {
		return nil, err
	}
	return &org, nil
}

func (r *OrgRepository) GetBySlug(slug string) (*Organization, error) {
	var org Organization
	if err := r.db.Where("slug = ?", slug).First(&org).Error; err != nil {
		return nil, err
	}
	return &org, nil
}

func (r *OrgRepository) Update(org *Organization) error {
	return r.db.Save(org).Error
}

func (r *OrgRepository) Delete(org *Organization) error {
	return r.db.Delete(org).Error
}

// --- Members ---

func (r *OrgRepository) AddMember(member *OrganizationMember) error {
	return r.db.Create(member).Error
}

func (r *OrgRepository) RemoveMember(orgID, userID uint) error {
	return r.db.Where("org_id = ? AND user_id = ?", orgID, userID).Delete(&OrganizationMember{}).Error
}

func (r *OrgRepository) GetMember(orgID, userID uint) (*OrganizationMember, error) {
	var m OrganizationMember
	if err := r.db.Where("org_id = ? AND user_id = ?", orgID, userID).First(&m).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *OrgRepository) GetMembers(orgID uint) ([]OrganizationMember, error) {
	var members []OrganizationMember
	if err := r.db.Where("org_id = ?", orgID).Find(&members).Error; err != nil {
		return nil, err
	}
	return members, nil
}

func (r *OrgRepository) GetOrgsByUserID(userID uint) ([]Organization, error) {
	var orgs []Organization
	err := r.db.Joins("JOIN organization_members ON organization_members.org_id = organizations.id").
		Where("organization_members.user_id = ? AND organization_members.deleted_at IS NULL", userID).
		Find(&orgs).Error
	return orgs, err
}

func (r *OrgRepository) GetUserRole(orgID, userID uint) (OrgRole, error) {
	m, err := r.GetMember(orgID, userID)
	if err != nil {
		return "", err
	}
	return m.Role, nil
}

func (r *OrgRepository) UpdateMemberRole(orgID, userID uint, role OrgRole) error {
	return r.db.Model(&OrganizationMember{}).
		Where("org_id = ? AND user_id = ?", orgID, userID).
		Update("role", role).Error
}

// --- Quota helpers ---

func (r *OrgRepository) CountLabsByOrgID(orgID uint) (int64, error) {
	var count int64
	err := r.db.Table("labs").Where("org_id = ? AND state NOT IN (?, ?)", orgID, "stopped", "failed").Count(&count).Error
	return count, err
}

func (r *OrgRepository) CountWorkersByOrgID(orgID uint) (int64, error) {
	var count int64
	err := r.db.Table("workers").Where("org_id = ?", orgID).Count(&count).Error
	return count, err
}
