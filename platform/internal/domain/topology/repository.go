package topology

import (
	"gorm.io/gorm"
)

type TopologyRepository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *TopologyRepository {
	return &TopologyRepository{db: db}
}

func (r *TopologyRepository) Create(topology *Topology) error {
	return r.db.Create(topology).Error
}

func (r *TopologyRepository) GetByUUID(uuid string) (*Topology, error) {
	var topology Topology
	if err := r.db.Where("uuid = ?", uuid).First(&topology).Error; err != nil {
		return nil, err
	}
	return &topology, nil
}

func (r *TopologyRepository) GetAll() ([]Topology, error) {
	var topologies []Topology
	if err := r.db.Find(&topologies).Error; err != nil {
		return nil, err
	}
	return topologies, nil
}

func (r *TopologyRepository) GetAllByOrgID(orgID uint) ([]Topology, error) {
	var topologies []Topology
	if err := r.db.Where("org_id = ?", orgID).Find(&topologies).Error; err != nil {
		return nil, err
	}
	return topologies, nil
}

func (r *TopologyRepository) GetByCollectionIDs(collectionIDs []uint) ([]Topology, error) {
	var topologies []Topology
	if err := r.db.Where("collection_id IN ?", collectionIDs).Find(&topologies).Error; err != nil {
		return nil, err
	}
	return topologies, nil
}

func (r *TopologyRepository) Update(topology *Topology) error {
	return r.db.Save(topology).Error
}

func (r *TopologyRepository) Delete(id uint) error {
	return r.db.Delete(&Topology{}, id).Error
}

func (r *TopologyRepository) CreateBindFile(file *BindFile) error {
	return r.db.Create(file).Error
}

func (r *TopologyRepository) GetBindFileByUUID(uuid string) (*BindFile, error) {
	var file BindFile
	if err := r.db.Where("uuid = ?", uuid).First(&file).Error; err != nil {
		return nil, err
	}
	return &file, nil
}

func (r *TopologyRepository) GetBindFilesByTopologyID(topologyID uint) ([]BindFile, error) {
	var files []BindFile
	if err := r.db.Where("topology_id = ?", topologyID).Find(&files).Error; err != nil {
		return nil, err
	}
	return files, nil
}

func (r *TopologyRepository) UpdateBindFile(file *BindFile) error {
	return r.db.Save(file).Error
}

func (r *TopologyRepository) DeleteBindFile(id uint) error {
	return r.db.Delete(&BindFile{}, id).Error
}
