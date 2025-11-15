package usecase

import (
	"context"
	"strings"
	"time"

	"github.com/PolygonPictures/central30-web/front/entity"
	"github.com/PolygonPictures/central30-web/front/repository"
)

type ReviewInfo struct {
	repo         *repository.ReviewInfo
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

func (uc *ReviewInfo) ListAssetsPivot(
	ctx context.Context,
	project, root, preferredPhase, sortKey, direction string,
	limit, offset int,
	assetNameKey string,
	approvalStatuses []string,
	workStatuses []string,
) ([]entity.AssetPivot, int64, error) {

	// --- sanitise params ---
	if root == "" {
		root = "assets"
	}
	if limit <= 0 {
		limit = 15
	}
	if offset < 0 {
		offset = 0
	}

	dir := strings.ToLower(direction)
	if dir != "asc" && dir != "desc" {
		dir = "asc"
	}

	// --- context / timeout ---
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.ReadTimeout)
	defer cancel()

	db := uc.repo.WithContext(timeoutCtx)
	if err := uc.checkForProject(db, project); err != nil {
		return nil, 0, err
	}

	// --- repository call ---
	list, total, err := uc.repo.ListAssetsPivot(
		timeoutCtx,
		project,
		root,
		preferredPhase,
		sortKey,
		dir,
		limit,
		offset,
		assetNameKey,
		approvalStatuses,
		workStatuses,
	)
	if err != nil {
		return nil, 0, err
	}

	// Convert []repository.AssetPivot -> []entity.AssetPivot
	entityList := make([]entity.AssetPivot, len(list))
	for i, v := range list {
		entityList[i] = entity.AssetPivot(v)
	}

	return entityList, total, nil
}
