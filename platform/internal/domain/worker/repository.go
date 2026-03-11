package worker

import (
	"time"

	"gorm.io/gorm"
)

type WorkerRepository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *WorkerRepository {
	return &WorkerRepository{db: db}
}

func (r *WorkerRepository) Create(worker *Worker) error {
	return r.db.Create(worker).Error
}

func (r *WorkerRepository) GetByID(id uint) (*Worker, error) {
	var w Worker
	if err := r.db.First(&w, id).Error; err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *WorkerRepository) GetByUUID(uuid string) (*Worker, error) {
	var w Worker
	if err := r.db.Where("uuid = ?", uuid).First(&w).Error; err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *WorkerRepository) GetByName(name string) (*Worker, error) {
	var w Worker
	if err := r.db.Where("name = ?", name).First(&w).Error; err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *WorkerRepository) GetByNameAndOrgID(name string, orgID uint) (*Worker, error) {
	var w Worker
	if err := r.db.Where("name = ? AND org_id = ?", name, orgID).First(&w).Error; err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *WorkerRepository) GetAll() ([]Worker, error) {
	var workers []Worker
	if err := r.db.Find(&workers).Error; err != nil {
		return nil, err
	}
	return workers, nil
}

func (r *WorkerRepository) GetAllByOrgID(orgID uint) ([]Worker, error) {
	var workers []Worker
	if err := r.db.Where("org_id = ?", orgID).Find(&workers).Error; err != nil {
		return nil, err
	}
	return workers, nil
}

func (r *WorkerRepository) Update(worker *Worker) error {
	return r.db.Save(worker).Error
}

func (r *WorkerRepository) Delete(worker *Worker) error {
	return r.db.Delete(worker).Error
}

// GetAvailable returns online workers ordered by active labs ascending (least loaded first).
func (r *WorkerRepository) GetAvailable() ([]Worker, error) {
	var workers []Worker
	err := r.db.
		Where("state = ?", StateOnline).
		Order("active_labs ASC").
		Find(&workers).Error
	if err != nil {
		return nil, err
	}
	return workers, nil
}

// UpdateHeartbeat sets the worker's heartbeat timestamp, active lab count, and state to online.
func (r *WorkerRepository) UpdateHeartbeat(uuid string, activeLabs int) error {
	now := time.Now()
	return r.db.
		Model(&Worker{}).
		Where("uuid = ?", uuid).
		Updates(map[string]interface{}{
			"last_heartbeat": now,
			"active_labs":    activeLabs,
			"state":          StateOnline,
		}).Error
}
