package template

import (
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"gopkg.in/yaml.v3"
)

// ResolveUUID maps an internal ID to an external UUID string.
type ResolveUUID func(id uint) (string, error)

type TemplateService struct {
	repo               *TemplateRepository
	resolveCollectionUUID ResolveUUID
	resolveUserUUID       ResolveUUID
}

func NewService(repo *TemplateRepository, resolveCollectionUUID, resolveUserUUID ResolveUUID) *TemplateService {
	return &TemplateService{
		repo:               repo,
		resolveCollectionUUID: resolveCollectionUUID,
		resolveUserUUID:       resolveUserUUID,
	}
}

func (s *TemplateService) Create(creatorID uint, collectionID uint, req CreateRequest) (Response, error) {
	return s.CreateWithOrg(creatorID, collectionID, 0, req)
}

func (s *TemplateService) CreateWithOrg(creatorID uint, collectionID uint, orgID uint, req CreateRequest) (Response, error) {
	templateType := req.Type
	if templateType == "" {
		templateType = "network"
	}

	tmpl := &Template{
		UUID:         uuid.New().String(),
		Name:         req.Name,
		Type:         templateType,
		Definition:   req.Definition,
		OrgID:        orgID,
		CollectionID: collectionID,
		CreatorID:    creatorID,
	}

	if err := s.repo.Create(tmpl); err != nil {
		return Response{}, errors.New("failed to create template")
	}

	return s.buildResponse(tmpl, nil)
}

// CheckOrgOwnership verifies that a template belongs to the given org.
func (s *TemplateService) CheckOrgOwnership(topoUUID string, orgID uint) error {
	t, err := s.repo.GetByUUID(topoUUID)
	if err != nil {
		return fmt.Errorf("template not found: %w", err)
	}
	if t.OrgID != orgID {
		return errors.New("template does not belong to this organization")
	}
	return nil
}

func (s *TemplateService) GetByUUID(templateUUID string) (Response, error) {
	tmpl, err := s.repo.GetByUUID(templateUUID)
	if err != nil {
		return Response{}, errors.New("template not found")
	}

	files, err := s.repo.GetBindFilesByTemplateID(tmpl.ID)
	if err != nil {
		return Response{}, errors.New("failed to retrieve bind files")
	}

	return s.buildResponse(tmpl, files)
}

func (s *TemplateService) GetAllByOrg(orgID uint) ([]Response, error) {
	templates, err := s.repo.GetAllByOrgID(orgID)
	if err != nil {
		return nil, errors.New("failed to retrieve templates")
	}
	return s.buildResponses(templates)
}

func (s *TemplateService) GetAll(collectionIDs []uint) ([]Response, error) {
	if len(collectionIDs) == 0 {
		return []Response{}, nil
	}

	templates, err := s.repo.GetByCollectionIDs(collectionIDs)
	if err != nil {
		return nil, errors.New("failed to retrieve templates")
	}

	return s.buildResponses(templates)
}

func (s *TemplateService) GetAllAdmin() ([]Response, error) {
	templates, err := s.repo.GetAll()
	if err != nil {
		return nil, errors.New("failed to retrieve templates")
	}

	return s.buildResponses(templates)
}

func (s *TemplateService) Update(templateUUID string, req UpdateRequest) (Response, error) {
	tmpl, err := s.repo.GetByUUID(templateUUID)
	if err != nil {
		return Response{}, errors.New("template not found")
	}

	if req.Name != nil {
		tmpl.Name = *req.Name
	}
	if req.Definition != nil {
		tmpl.Definition = *req.Definition
	}

	if err := s.repo.Update(tmpl); err != nil {
		return Response{}, errors.New("failed to update template")
	}

	files, err := s.repo.GetBindFilesByTemplateID(tmpl.ID)
	if err != nil {
		return Response{}, errors.New("failed to retrieve bind files")
	}

	return s.buildResponse(tmpl, files)
}

func (s *TemplateService) Delete(templateUUID string) error {
	tmpl, err := s.repo.GetByUUID(templateUUID)
	if err != nil {
		return errors.New("template not found")
	}
	return s.repo.Delete(tmpl.ID)
}

func (s *TemplateService) CreateBindFile(templateUUID string, req CreateBindFileRequest) (BindFileResponse, error) {
	tmpl, err := s.repo.GetByUUID(templateUUID)
	if err != nil {
		return BindFileResponse{}, errors.New("template not found")
	}

	file := &BindFile{
		UUID:       uuid.New().String(),
		TemplateID: tmpl.ID,
		FilePath:   req.FilePath,
		Content:    []byte(req.Content),
		NosKind:    req.NosKind,
	}

	if err := s.repo.CreateBindFile(file); err != nil {
		return BindFileResponse{}, errors.New("failed to create bind file")
	}

	return buildBindFileResponse(file), nil
}

func (s *TemplateService) UpdateBindFile(fileUUID string, req UpdateBindFileRequest) (BindFileResponse, error) {
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
	if req.NosKind != nil {
		file.NosKind = *req.NosKind
	}

	if err := s.repo.UpdateBindFile(file); err != nil {
		return BindFileResponse{}, errors.New("failed to update bind file")
	}

	return buildBindFileResponse(file), nil
}

func (s *TemplateService) DeleteBindFile(fileUUID string) error {
	file, err := s.repo.GetBindFileByUUID(fileUUID)
	if err != nil {
		return errors.New("bind file not found")
	}
	return s.repo.DeleteBindFile(file.ID)
}

func (s *TemplateService) buildResponse(t *Template, files []BindFile) (Response, error) {
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
		Type:         t.Type,
		Definition:   t.Definition,
		CollectionID: collectionUUID,
		CreatorID:    creatorUUID,
		BindFiles:    bindFiles,
		CreatedAt:    t.CreatedAt,
		UpdatedAt:    t.UpdatedAt,
	}, nil
}

func (s *TemplateService) buildResponses(templates []Template) ([]Response, error) {
	responses := make([]Response, len(templates))
	for i, t := range templates {
		files, err := s.repo.GetBindFilesByTemplateID(t.ID)
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
func (s *TemplateService) Validate(definition string) (errs []string, warnings []string) {
	var raw map[string]interface{}
	if err := yaml.Unmarshal([]byte(definition), &raw); err != nil {
		return []string{fmt.Sprintf("invalid YAML: %v", err)}, nil
	}

	if _, ok := raw["name"]; !ok {
		errs = append(errs, "missing required field: name")
	}

	topo, ok := raw["tmpl"]
	if !ok {
		errs = append(errs, "missing required field: tmpl")
		return errs, warnings
	}

	topoMap, ok := topo.(map[string]interface{})
	if !ok {
		errs = append(errs, "tmpl must be a map")
		return errs, warnings
	}

	nodes, ok := topoMap["nodes"]
	if !ok {
		errs = append(errs, "missing required field: tmpl.nodes")
		return errs, warnings
	}

	nodesMap, ok := nodes.(map[string]interface{})
	if !ok {
		errs = append(errs, "tmpl.nodes must be a map")
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
			errs = append(errs, "tmpl.links must be a list")
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
		Content:   string(f.Content),
		NosKind:   f.NosKind,
		CreatedAt: f.CreatedAt,
	}
}
