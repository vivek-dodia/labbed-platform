package guide

import (
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) GetByTemplateID(templateID uint) (*LabGuide, error) {
	var g LabGuide
	if err := r.db.Where("template_id = ?", templateID).First(&g).Error; err != nil {
		return nil, err
	}
	return &g, nil
}

func (r *Repository) Create(g *LabGuide) error {
	return r.db.Create(g).Error
}

func (r *Repository) Upsert(g *LabGuide) error {
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "template_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"title", "description", "difficulty", "concepts", "topology_notes", "estimated_time", "steps"}),
	}).Create(g).Error
}

func (r *Repository) GetProgress(userID, templateID uint) ([]GuideProgress, error) {
	var progress []GuideProgress
	if err := r.db.Where("user_id = ? AND template_id = ?", userID, templateID).
		Order("step_index").Find(&progress).Error; err != nil {
		return nil, err
	}
	return progress, nil
}

func (r *Repository) MarkStepComplete(userID, templateID uint, stepIndex int) error {
	p := GuideProgress{
		UserID:      userID,
		TemplateID:  templateID,
		StepIndex:   stepIndex,
		CompletedAt: time.Now(),
	}
	return r.db.Where("user_id = ? AND template_id = ? AND step_index = ?",
		userID, templateID, stepIndex).
		FirstOrCreate(&p).Error
}

func (r *Repository) ResetProgress(userID, templateID uint) error {
	return r.db.Where("user_id = ? AND template_id = ?", userID, templateID).
		Delete(&GuideProgress{}).Error
}

func (r *Repository) HasGuideForTemplateIDs(templateIDs []uint) (map[uint]bool, error) {
	var guides []LabGuide
	if err := r.db.Select("template_id").Where("template_id IN ?", templateIDs).Find(&guides).Error; err != nil {
		return nil, err
	}
	result := make(map[uint]bool)
	for _, g := range guides {
		result[g.TemplateID] = true
	}
	return result, nil
}
