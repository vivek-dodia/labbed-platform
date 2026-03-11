package collection

import (
	"errors"
	"fmt"

	"github.com/google/uuid"
)

// ResolveUUID maps an internal user ID to an external UUID string.
type ResolveUUID func(id uint) (string, error)

type CollectionService struct {
	repo            *CollectionRepository
	resolveUserUUID ResolveUUID
}

func NewService(repo *CollectionRepository, resolveUserUUID ResolveUUID) *CollectionService {
	return &CollectionService{repo: repo, resolveUserUUID: resolveUserUUID}
}

func (s *CollectionService) resolveCreator(creatorID uint) string {
	if s.resolveUserUUID != nil {
		if uuid, err := s.resolveUserUUID(creatorID); err == nil {
			return uuid
		}
	}
	return ""
}

func (s *CollectionService) Create(creatorID uint, creatorUUID string, req CreateRequest) (Response, error) {
	col := &Collection{
		UUID:         uuid.New().String(),
		Name:         req.Name,
		CreatorID:    creatorID,
		PublicRead:   req.PublicRead,
		PublicDeploy: req.PublicDeploy,
	}

	if err := s.repo.Create(col); err != nil {
		return Response{}, fmt.Errorf("failed to create collection: %w", err)
	}

	member := &CollectionMember{
		CollectionID: col.ID,
		UserID:       creatorID,
		Role:         "owner",
	}
	if err := s.repo.AddMember(member); err != nil {
		return Response{}, fmt.Errorf("failed to add creator as owner: %w", err)
	}

	return col.ToResponse(creatorUUID), nil
}

func (s *CollectionService) GetAll(userID uint, isAdmin bool) ([]Response, error) {
	var collections []Collection
	var err error

	if isAdmin {
		collections, err = s.repo.GetAll()
	} else {
		collections, err = s.repo.GetByUserID(userID)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to list collections: %w", err)
	}

	responses := make([]Response, len(collections))
	for i, col := range collections {
		responses[i] = col.ToResponse(s.resolveCreator(col.CreatorID))
	}
	return responses, nil
}

func (s *CollectionService) GetByUUID(uuid string) (Response, error) {
	col, err := s.repo.GetByUUID(uuid)
	if err != nil {
		return Response{}, fmt.Errorf("collection not found: %w", err)
	}
	return col.ToResponse(s.resolveCreator(col.CreatorID)), nil
}

func (s *CollectionService) Update(uuid string, userID uint, isAdmin bool, req UpdateRequest) (Response, error) {
	col, err := s.repo.GetByUUID(uuid)
	if err != nil {
		return Response{}, fmt.Errorf("collection not found: %w", err)
	}

	if !isAdmin && col.CreatorID != userID {
		return Response{}, errors.New("only the creator or an admin can update this collection")
	}

	if req.Name != nil {
		col.Name = *req.Name
	}
	if req.PublicRead != nil {
		col.PublicRead = *req.PublicRead
	}
	if req.PublicDeploy != nil {
		col.PublicDeploy = *req.PublicDeploy
	}

	if err := s.repo.Update(col); err != nil {
		return Response{}, fmt.Errorf("failed to update collection: %w", err)
	}

	return col.ToResponse(s.resolveCreator(col.CreatorID)), nil
}

func (s *CollectionService) Delete(uuid string, userID uint, isAdmin bool) error {
	col, err := s.repo.GetByUUID(uuid)
	if err != nil {
		return fmt.Errorf("collection not found: %w", err)
	}

	if !isAdmin && col.CreatorID != userID {
		return errors.New("only the creator or an admin can delete this collection")
	}

	return s.repo.Delete(col.ID)
}

func (s *CollectionService) AddMember(collectionUUID string, req AddMemberRequest, userID uint, isAdmin bool, resolveUserID func(string) (uint, error)) error {
	col, err := s.repo.GetByUUID(collectionUUID)
	if err != nil {
		return fmt.Errorf("collection not found: %w", err)
	}

	if !isAdmin {
		isMember, role, err := s.repo.IsUserMember(col.ID, userID)
		if err != nil {
			return fmt.Errorf("failed to check membership: %w", err)
		}
		if !isMember || role != "owner" {
			return errors.New("only collection owners or admins can add members")
		}
	}

	targetUserID, err := resolveUserID(req.UserID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	member := &CollectionMember{
		CollectionID: col.ID,
		UserID:       targetUserID,
		Role:         req.Role,
	}
	return s.repo.AddMember(member)
}

func (s *CollectionService) RemoveMember(collectionUUID string, memberUserUUID string, userID uint, isAdmin bool, resolveUserID func(string) (uint, error)) error {
	col, err := s.repo.GetByUUID(collectionUUID)
	if err != nil {
		return fmt.Errorf("collection not found: %w", err)
	}

	if !isAdmin {
		isMember, role, err := s.repo.IsUserMember(col.ID, userID)
		if err != nil {
			return fmt.Errorf("failed to check membership: %w", err)
		}
		if !isMember || role != "owner" {
			return errors.New("only collection owners or admins can remove members")
		}
	}

	targetUserID, err := resolveUserID(memberUserUUID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	return s.repo.RemoveMember(col.ID, targetUserID)
}
