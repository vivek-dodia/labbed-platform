package topology

import (
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"gopkg.in/yaml.v3"
)

// ResolveUUID maps an internal ID to an external UUID string.
type ResolveUUID func(id uint) (string, error)

type TopologyService struct {
	repo               *TopologyRepository
	resolveCollectionUUID ResolveUUID
	resolveUserUUID       ResolveUUID
}

func NewService(repo *TopologyRepository, resolveCollectionUUID, resolveUserUUID ResolveUUID) *TopologyService {
	return &TopologyService{
		repo:               repo,
		resolveCollectionUUID: resolveCollectionUUID,
		resolveUserUUID:       resolveUserUUID,
	}
}

func (s *TopologyService) Create(creatorID uint, collectionID uint, req CreateRequest) (Response, error) {
	return s.CreateWithOrg(creatorID, collectionID, 0, req)
}

func (s *TopologyService) CreateWithOrg(creatorID uint, collectionID uint, orgID uint, req CreateRequest) (Response, error) {
	topology := &Topology{
		UUID:         uuid.New().String(),
		Name:         req.Name,
		Definition:   req.Definition,
		OrgID:        orgID,
		CollectionID: collectionID,
		CreatorID:    creatorID,
	}

	if err := s.repo.Create(topology); err != nil {
		return Response{}, errors.New("failed to create topology")
	}

	return s.buildResponse(topology, nil)
}

// CheckOrgOwnership verifies that a topology belongs to the given org.
func (s *TopologyService) CheckOrgOwnership(topoUUID string, orgID uint) error {
	t, err := s.repo.GetByUUID(topoUUID)
	if err != nil {
		return fmt.Errorf("topology not found: %w", err)
	}
	if t.OrgID != orgID {
		return errors.New("topology does not belong to this organization")
	}
	return nil
}

func (s *TopologyService) GetByUUID(topologyUUID string) (Response, error) {
	topology, err := s.repo.GetByUUID(topologyUUID)
	if err != nil {
		return Response{}, errors.New("topology not found")
	}

	files, err := s.repo.GetBindFilesByTopologyID(topology.ID)
	if err != nil {
		return Response{}, errors.New("failed to retrieve bind files")
	}

	return s.buildResponse(topology, files)
}

func (s *TopologyService) GetAllByOrg(orgID uint) ([]Response, error) {
	topologies, err := s.repo.GetAllByOrgID(orgID)
	if err != nil {
		return nil, errors.New("failed to retrieve topologies")
	}
	return s.buildResponses(topologies)
}

func (s *TopologyService) GetAll(collectionIDs []uint) ([]Response, error) {
	if len(collectionIDs) == 0 {
		return []Response{}, nil
	}

	topologies, err := s.repo.GetByCollectionIDs(collectionIDs)
	if err != nil {
		return nil, errors.New("failed to retrieve topologies")
	}

	return s.buildResponses(topologies)
}

func (s *TopologyService) GetAllAdmin() ([]Response, error) {
	topologies, err := s.repo.GetAll()
	if err != nil {
		return nil, errors.New("failed to retrieve topologies")
	}

	return s.buildResponses(topologies)
}

func (s *TopologyService) Update(topologyUUID string, req UpdateRequest) (Response, error) {
	topology, err := s.repo.GetByUUID(topologyUUID)
	if err != nil {
		return Response{}, errors.New("topology not found")
	}

	if req.Name != nil {
		topology.Name = *req.Name
	}
	if req.Definition != nil {
		topology.Definition = *req.Definition
	}

	if err := s.repo.Update(topology); err != nil {
		return Response{}, errors.New("failed to update topology")
	}

	files, err := s.repo.GetBindFilesByTopologyID(topology.ID)
	if err != nil {
		return Response{}, errors.New("failed to retrieve bind files")
	}

	return s.buildResponse(topology, files)
}

func (s *TopologyService) Delete(topologyUUID string) error {
	topology, err := s.repo.GetByUUID(topologyUUID)
	if err != nil {
		return errors.New("topology not found")
	}
	return s.repo.Delete(topology.ID)
}

func (s *TopologyService) CreateBindFile(topologyUUID string, req CreateBindFileRequest) (BindFileResponse, error) {
	topology, err := s.repo.GetByUUID(topologyUUID)
	if err != nil {
		return BindFileResponse{}, errors.New("topology not found")
	}

	file := &BindFile{
		UUID:       uuid.New().String(),
		TopologyID: topology.ID,
		FilePath:   req.FilePath,
		Content:    []byte(req.Content),
	}

	if err := s.repo.CreateBindFile(file); err != nil {
		return BindFileResponse{}, errors.New("failed to create bind file")
	}

	return buildBindFileResponse(file), nil
}

func (s *TopologyService) UpdateBindFile(fileUUID string, req UpdateBindFileRequest) (BindFileResponse, error) {
	file, err := s.repo.GetBindFileByUUID(fileUUID)
	if err != nil {
		return BindFileResponse{}, errors.New("bind file not found")
	}

	if req.FilePath != nil {
		file.FilePath = *req.FilePath
	}
	if req.Content != nil {
		file.Content = []byte(*req.Content)
	}

	if err := s.repo.UpdateBindFile(file); err != nil {
		return BindFileResponse{}, errors.New("failed to update bind file")
	}

	return buildBindFileResponse(file), nil
}

func (s *TopologyService) DeleteBindFile(fileUUID string) error {
	file, err := s.repo.GetBindFileByUUID(fileUUID)
	if err != nil {
		return errors.New("bind file not found")
	}
	return s.repo.DeleteBindFile(file.ID)
}

func (s *TopologyService) buildResponse(t *Topology, files []BindFile) (Response, error) {
	collectionUUID := fmt.Sprintf("%d", t.CollectionID)
	if s.resolveCollectionUUID != nil {
		if resolved, err := s.resolveCollectionUUID(t.CollectionID); err == nil {
			collectionUUID = resolved
		}
	}

	creatorUUID := fmt.Sprintf("%d", t.CreatorID)
	if s.resolveUserUUID != nil {
		if resolved, err := s.resolveUserUUID(t.CreatorID); err == nil {
			creatorUUID = resolved
		}
	}

	bindFiles := make([]BindFileResponse, len(files))
	for i, f := range files {
		bindFiles[i] = buildBindFileResponse(&f)
	}

	return Response{
		UUID:         t.UUID,
		Name:         t.Name,
		Definition:   t.Definition,
		CollectionID: collectionUUID,
		CreatorID:    creatorUUID,
		BindFiles:    bindFiles,
		CreatedAt:    t.CreatedAt,
		UpdatedAt:    t.UpdatedAt,
	}, nil
}

func (s *TopologyService) buildResponses(topologies []Topology) ([]Response, error) {
	responses := make([]Response, len(topologies))
	for i, t := range topologies {
		files, err := s.repo.GetBindFilesByTopologyID(t.ID)
		if err != nil {
			return nil, errors.New("failed to retrieve bind files")
		}
		resp, err := s.buildResponse(&t, files)
		if err != nil {
			return nil, err
		}
		responses[i] = resp
	}
	return responses, nil
}

// Validate checks a containerlab YAML definition for errors and warnings.
func (s *TopologyService) Validate(definition string) (errs []string, warnings []string) {
	var raw map[string]interface{}
	if err := yaml.Unmarshal([]byte(definition), &raw); err != nil {
		return []string{fmt.Sprintf("invalid YAML: %v", err)}, nil
	}

	if _, ok := raw["name"]; !ok {
		errs = append(errs, "missing required field: name")
	}

	topo, ok := raw["topology"]
	if !ok {
		errs = append(errs, "missing required field: topology")
		return errs, warnings
	}

	topoMap, ok := topo.(map[string]interface{})
	if !ok {
		errs = append(errs, "topology must be a map")
		return errs, warnings
	}

	nodes, ok := topoMap["nodes"]
	if !ok {
		errs = append(errs, "missing required field: topology.nodes")
		return errs, warnings
	}

	nodesMap, ok := nodes.(map[string]interface{})
	if !ok {
		errs = append(errs, "topology.nodes must be a map")
		return errs, warnings
	}

	nodeNames := make(map[string]bool)
	for name, v := range nodesMap {
		nodeNames[name] = true
		node, ok := v.(map[string]interface{})
		if !ok {
			errs = append(errs, fmt.Sprintf("node %q must be a map", name))
			continue
		}
		if _, ok := node["kind"]; !ok {
			warnings = append(warnings, fmt.Sprintf("node %q missing kind (defaults to linux)", name))
		}
		if _, ok := node["image"]; !ok {
			errs = append(errs, fmt.Sprintf("node %q missing required field: image", name))
		}
	}

	// Validate links reference valid nodes
	if links, ok := topoMap["links"]; ok {
		linksList, ok := links.([]interface{})
		if !ok {
			errs = append(errs, "topology.links must be a list")
		} else {
			for i, link := range linksList {
				linkMap, ok := link.(map[string]interface{})
				if !ok {
					continue
				}
				endpoints, ok := linkMap["endpoints"]
				if !ok {
					errs = append(errs, fmt.Sprintf("link %d missing endpoints", i))
					continue
				}
				epList, ok := endpoints.([]interface{})
				if !ok || len(epList) != 2 {
					errs = append(errs, fmt.Sprintf("link %d endpoints must be a list of 2", i))
					continue
				}
				for _, ep := range epList {
					epStr, ok := ep.(string)
					if !ok {
						continue
					}
					parts := strings.SplitN(epStr, ":", 2)
					if len(parts) >= 1 && !nodeNames[parts[0]] {
						errs = append(errs, fmt.Sprintf("link %d references unknown node %q", i, parts[0]))
					}
				}
			}
		}
	}

	return errs, warnings
}

func buildBindFileResponse(f *BindFile) BindFileResponse {
	return BindFileResponse{
		UUID:      f.UUID,
		FilePath:  f.FilePath,
		CreatedAt: f.CreatedAt,
	}
}
