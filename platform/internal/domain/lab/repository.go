package lab

import (
	"time"

	"gorm.io/gorm"
)

type LabRepository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *LabRepository {
	return &LabRepository{db: db}
}

func (r *LabRepository) Create(lab *Lab) error {
	return r.db.Create(lab).Error
}

func (r *LabRepository) GetByUUID(uuid string) (*Lab, error) {
	var l Lab
	if err := r.db.Where("uuid = ?", uuid).First(&l).Error; err != nil {
		return nil, err
	}
	return &l, nil
}

func (r *LabRepository) GetAll() ([]Lab, error) {
	var labs []Lab
	if err := r.db.Find(&labs).Error; err != nil {
		return nil, err
	}
	return labs, nil
}

func (r *LabRepository) GetByCreatorID(creatorID uint) ([]Lab, error) {
	var labs []Lab
	if err := r.db.Where("creator_id = ?", creatorID).Find(&labs).Error; err != nil {
		return nil, err
	}
	return labs, nil
}

func (r *LabRepository) GetByWorkerID(workerID uint) ([]Lab, error) {
	var labs []Lab
	if err := r.db.Where("worker_id = ?", workerID).Find(&labs).Error; err != nil {
		return nil, err
	}
	return labs, nil
}

func (r *LabRepository) Update(lab *Lab) error {
	return r.db.Save(lab).Error
}

func (r *LabRepository) Delete(lab *Lab) error {
	return r.db.Delete(lab).Error
}

// GetByState returns all labs in a given state.
func (r *LabRepository) GetByState(state LabState) ([]Lab, error) {
	var labs []Lab
	if err := r.db.Where("state = ?", state).Find(&labs).Error; err != nil {
		return nil, err
	}
	return labs, nil
}

// GetScheduledForDeploy returns labs that are scheduled and whose start time has arrived.
func (r *LabRepository) GetScheduledForDeploy() ([]Lab, error) {
	var labs []Lab
	err := r.db.
		Where("state = ? AND scheduled_start <= ?", StateScheduled, time.Now()).
		Find(&labs).Error
	if err != nil {
		return nil, err
	}
	return labs, nil
}

// GetScheduledForDestroy returns running labs whose scheduled end time has passed.
func (r *LabRepository) GetScheduledForDestroy() ([]Lab, error) {
	var labs []Lab
	err := r.db.
		Where("state = ? AND scheduled_end <= ?", StateRunning, time.Now()).
		Find(&labs).Error
	if err != nil {
		return nil, err
	}
	return labs, nil
}

func (r *LabRepository) CreateNodes(nodes []LabNode) error {
	if len(nodes) == 0 {
		return nil
	}
	return r.db.Create(&nodes).Error
}

func (r *LabRepository) GetNodesByLabID(labID uint) ([]LabNode, error) {
	var nodes []LabNode
	if err := r.db.Where("lab_id = ?", labID).Find(&nodes).Error; err != nil {
		return nil, err
	}
	return nodes, nil
}

func (r *LabRepository) DeleteNodesByLabID(labID uint) error {
	return r.db.Where("lab_id = ?", labID).Delete(&LabNode{}).Error
}
