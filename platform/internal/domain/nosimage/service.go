package nosimage

import (
	"errors"
	"fmt"

	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(orgID uint, req CreateRequest) (Response, error) {
	img := &NosImage{
		UUID:        uuid.New().String(),
		Name:        req.Name,
		ClabKind:    req.ClabKind,
		DockerImage: req.DockerImage,
		DefaultUser: req.DefaultUser,
		DefaultPass: req.DefaultPass,
		IsSystem:    false,
		OrgID:       orgID,
	}
	if err := s.repo.Create(img); err != nil {
		return Response{}, fmt.Errorf("failed to create NOS image: %w", err)
	}
	return img.ToResponse(), nil
}

func (s *Service) GetAvailable(orgID uint) ([]Response, error) {
	images, err := s.repo.GetAvailable(orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to list NOS images: %w", err)
	}
	responses := make([]Response, len(images))
	for i, img := range images {
		responses[i] = img.ToResponse()
	}
	return responses, nil
}

func (s *Service) Delete(uuid string) error {
	img, err := s.repo.GetByUUID(uuid)
	if err != nil {
		return fmt.Errorf("NOS image not found: %w", err)
	}
	if img.IsSystem {
		return errors.New("cannot delete system NOS image")
	}
	return s.repo.Delete(img)
}

// ResolveImage looks up a NOS image by UUID and returns its ClabKind and DockerImage.
func (s *Service) ResolveImage(uuid string) (clabKind, dockerImage string, err error) {
	img, err := s.repo.GetByUUID(uuid)
	if err != nil {
		return "", "", fmt.Errorf("NOS image not found: %w", err)
	}
	return img.ClabKind, img.DockerImage, nil
}
