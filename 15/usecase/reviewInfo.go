/* ──────────────────────────────────────────────────────────────────────────
	Module Name:
    	usecase/reviewInfo.go

	Module Description:
		Usecase layer for managing review information.

	Details:

	Update and Modification History:
	* - 29-10-2025 - SanjayK PSI - Implemented dynamic filtering and sorting for latest submissions.
	* - 17-11-2025 - SanjayK PSI - Added phase-aware status filtering and sorting.
	* - 22-11-2025 - SanjayK PSI - Fixed bugs related to phase-specific filtering and sorting.
	* - [Current Date] - Updated to match new repository ListAssetsPivot signature

	Functions:
	* - ListAssetsPivot: Provides filtered, phase-aware pivoted asset data.

	────────────────────────────────────────────────────────────────────────── */

package usecase

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/PolygonPictures/central30-web/front/entity"
	"github.com/PolygonPictures/central30-web/front/repository"
	"github.com/gin-gonic/gin/binding"
	"gorm.io/gorm"
)

type ReviewInfo struct {
	repo         *repository.ReviewInfo
	prjRepo      *repository.ProjectInfo
	stuRepo      *repository.StudioInfo
	docRepo      entity.DocumentRepository
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

func NewReviewInfo(
	repo *repository.ReviewInfo,
	pr *repository.ProjectInfo,
	sr *repository.StudioInfo,
	dr entity.DocumentRepository,
	readTimeout time.Duration,
	writeTimeout time.Duration,
) *ReviewInfo {
	return &ReviewInfo{
		repo:         repo,
		prjRepo:      pr,
		stuRepo:      sr,
		docRepo:      dr,
		ReadTimeout:  readTimeout,
		WriteTimeout: writeTimeout,
	}
}

func (uc *ReviewInfo) checkForProject(db *gorm.DB, project string) error {
	_, err := uc.prjRepo.Get(db, &entity.GetProjectInfoParams{
		KeyName: project,
	})
	return err
}

func (uc *ReviewInfo) checkForStudio(db *gorm.DB, studio string) error {
	_, err := uc.stuRepo.Get(db, &entity.GetStudioInfoParams{
		KeyName: studio,
	})
	return err
}

func (uc *ReviewInfo) List(
	ctx context.Context,
	params *entity.ListReviewInfoParams,
) ([]*entity.ReviewInfo, int, error) {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return nil, 0, err
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.ReadTimeout)
	defer cancel()
	db := uc.repo.WithContext(timeoutCtx)
	if err := uc.checkForProject(db, params.Project); err != nil {
		return nil, 0, err
	}
	if params.Studio != nil {
		if err := uc.checkForStudio(db, *params.Studio); err != nil {
			return nil, 0, err
		}
	}
	return uc.repo.List(db, params)
}

func (uc *ReviewInfo) Get(
	ctx context.Context,
	params *entity.GetReviewParams,
) (*entity.ReviewInfo, error) {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return nil, err
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.ReadTimeout)
	defer cancel()
	db := uc.repo.WithContext(timeoutCtx)
	if err := uc.checkForProject(db, params.Project); err != nil {
		return nil, err
	}
	return uc.repo.Get(db, params)
}

func (uc *ReviewInfo) Create(
	ctx context.Context,
	params *entity.CreateReviewInfoParams,
) (*entity.ReviewInfo, error) {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return nil, err
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.WriteTimeout)
	defer cancel()
	db := uc.repo.WithContext(timeoutCtx)
	if err := uc.checkForProject(db, params.Project); err != nil {
		return nil, err
	}
	if err := uc.checkForStudio(db, params.Studio); err != nil {
		return nil, err
	}
	var e *entity.ReviewInfo
	if err := uc.repo.TransactionWithContext(timeoutCtx, func(tx *gorm.DB) error {
		var err error
		e, err = uc.repo.Create(tx, params)
		return err
	}); err != nil {
		return nil, err
	}

	// Create a comment when creating a review.
	// https://docs.google.com/spreadsheets/d/14VSOi7h_zh5TP0JK3nBXjVoAQhrete3XahPZ96h30Wo/edit#gid=734852926
	var user string
	if params.CreatedBy != nil {
		user = *params.CreatedBy
	}
	commentdata := []map[string]interface{}{}
	defaultrole := "artist"
	for _, commentinfo := range params.ReviewComments {
		role := commentinfo.ResponsiblePersonRole
		if role == nil {
			role = &defaultrole
		}
		comment := map[string]interface{}{
			"language":                commentinfo.Language,
			"text":                    commentinfo.Text,
			"attachments":             commentinfo.Attachments,
			"need_translation":        commentinfo.NeedTranslation,
			"is_translated":           commentinfo.IsTranslated,
			"responsible_person_role": role,
		}
		commentdata = append(commentdata, comment)
	}

	if _, err := uc.docRepo.CreateDocument(
		context.WithValue(timeoutCtx, entity.KeyUser, user),
		params.Project,
		"comment",
		map[string]interface{}{
			"root":                 params.Root,
			"groups":               params.Groups,
			"relation":             params.Relation,
			"phase":                params.Phase,
			"original_comment_id":  nil,
			"task_id":              params.TaskID,
			"subtask_id":           params.SubtaskID,
			"path":                 params.TakePath,
			"take":                 params.Take,
			"comment_data":         commentdata,
			"studio":               params.Studio,
			"project":              params.Project,
			"submitted_at_utc":     params.SubmittedAtUtc.Format(time.RFC3339Nano),
			"submitted_user":       params.SubmittedUser,
			"submitted_computer":   params.SubmittedComputer,
			"submitted_os":         params.SubmittedOS,
			"submitted_os_version": params.SubmittedOSVersion,
			"component":            params.Component,
			"type":                 "review",
			"tool":                 "ppiCentralWeb",
		},
	); err != nil {
		return nil, err
	}

	return e, nil
}

func (uc *ReviewInfo) Update(
	ctx context.Context,
	params *entity.UpdateReviewInfoParams,
) (*entity.ReviewInfo, error) {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return nil, err
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.WriteTimeout)
	defer cancel()
	db := uc.repo.WithContext(timeoutCtx)
	if err := uc.checkForProject(db, params.Project); err != nil {
		return nil, err
	}
	var e *entity.ReviewInfo
	if err := uc.repo.TransactionWithContext(timeoutCtx, func(tx *gorm.DB) error {
		var err error
		e, err = uc.repo.Update(tx, params)
		return err
	}); err != nil {
		return nil, err
	}
	return e, nil
}

func (uc *ReviewInfo) Delete(
	ctx context.Context,
	params *entity.DeleteReviewInfoParams,
) error {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return err
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.WriteTimeout)
	defer cancel()
	return uc.repo.TransactionWithContext(timeoutCtx, func(tx *gorm.DB) error {
		if err := uc.checkForProject(tx, params.Project); err != nil {
			return err
		}
		return uc.repo.Delete(tx, params)
	})
}

func (uc *ReviewInfo) ListAssets(
	ctx context.Context,
	params *entity.AssetListParams,
) ([]*entity.Asset, int, error) {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return nil, 0, err
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.ReadTimeout)
	defer cancel()
	db := uc.repo.WithContext(timeoutCtx)
	if err := uc.checkForProject(db, params.Project); err != nil {
		return nil, 0, err
	}
	if params.Studio != nil {
		if err := uc.checkForStudio(db, *params.Studio); err != nil {
			return nil, 0, err
		}
	}
	return uc.repo.ListAssets(db, params)
}

func (uc *ReviewInfo) ListAssetReviewInfos(
	ctx context.Context,
	params *entity.AssetReviewInfoListParams,
) ([]*entity.ReviewInfo, error) {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return nil, err
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.ReadTimeout)
	defer cancel()
	db := uc.repo.WithContext(timeoutCtx)
	if err := uc.checkForProject(db, params.Project); err != nil {
		return nil, err
	}
	if params.Studio != nil {
		if err := uc.checkForStudio(db, *params.Studio); err != nil {
			return nil, err
		}
	}
	return uc.repo.ListAssetReviewInfos(db, params)
}

func (uc *ReviewInfo) ListShotReviewInfos(
	ctx context.Context,
	params *entity.ShotReviewInfoListParams,
) ([]*entity.ReviewInfo, error) {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return nil, err
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.ReadTimeout)
	defer cancel()
	db := uc.repo.WithContext(timeoutCtx)
	if err := uc.checkForProject(db, params.Project); err != nil {
		return nil, err
	}
	if params.Studio != nil {
		if err := uc.checkForStudio(db, *params.Studio); err != nil {
			return nil, err
		}
	}
	return uc.repo.ListShotReviewInfos(db, params)
}

type ListAssetsPivotParams struct {
	Project          string
	Root             string
	PreferredPhase   string
	OrderKey         string
	Direction        string
	Page             int
	PerPage          int
	AssetNameKey     string
	ApprovalStatuses []string
	WorkStatuses     []string
	View             string // "list" or "grouped"
}

type ListAssetsPivotResult struct {
	Assets   []repository.AssetPivot
	Groups   []repository.GroupedAssetBucket
	Total    int64
	Page     int
	PerPage  int
	PageLast int
	HasNext  bool
	HasPrev  bool
	Sort     string
	Dir      string
}

// Add this method on your existing usecase.ReviewInfo
func (u *ReviewInfo) ListAssetsPivot(ctx context.Context, p ListAssetsPivotParams) (*ListAssetsPivotResult, error) {
	if p.Project == "" {
		return nil, fmt.Errorf("project is required")
	}
	if p.Root == "" {
		p.Root = "assets"
	}
	if p.PerPage <= 0 {
		p.PerPage = 15
	}
	if p.Page <= 0 {
		p.Page = 1
	}

	// normalize dir
	dir := strings.ToUpper(strings.TrimSpace(p.Direction))
	if dir != "ASC" && dir != "DESC" {
		dir = "ASC"
	}

	// Get database connection with context
	timeoutCtx, cancel := context.WithTimeout(ctx, u.ReadTimeout)
	defer cancel()
	db := u.repo.WithContext(timeoutCtx)

	// Check if project exists
	if err := u.checkForProject(db, p.Project); err != nil {
		return nil, err
	}

	// Create repository parameters
	repoParams := repository.ListAssetsPivotParams{
		Project:          p.Project,
		Root:             p.Root,
		View:             p.View,
		Page:             p.Page,
		PerPage:          p.PerPage,
		OrderKey:         p.OrderKey,
		Direction:        strings.ToLower(dir),
		ApprovalStatuses: p.ApprovalStatuses,
		WorkStatuses:     p.WorkStatuses,
	}

	// Call the repository method with the new signature
	result, err := u.repo.ListAssetsPivot(db, repoParams)
	if err != nil {
		return nil, err
	}

	// Convert repository result to usecase result
	return &ListAssetsPivotResult{
		Assets:   result.Assets,
		Groups:   result.Groups,
		Total:    result.Total,
		Page:     result.Page,
		PerPage:  result.PerPage,
		PageLast: result.PageLast,
		HasNext:  result.HasNext,
		HasPrev:  result.HasPrev,
		Sort:     result.Sort,
		Dir:      result.Dir,
	}, nil
}

// Helper method for backward compatibility - if you need the old signature somewhere
func (u *ReviewInfo) ListAssetsPivotOld(
	ctx context.Context,
	project, root, preferredPhase, orderKey, direction string,
	limit, offset int,
	assetNameKey string,
	approvalStatuses, workStatuses []string,
) ([]repository.AssetPivot, int64, error) {
	
	// Determine view type (default to list view)
	view := "list"
	
	// Create repository parameters
	repoParams := repository.ListAssetsPivotParams{
		Project:          project,
		Root:             root,
		View:             view,
		Page:             1, // Calculate page from offset/limit
		PerPage:          limit,
		OrderKey:         orderKey,
		Direction:        direction,
		ApprovalStatuses: approvalStatuses,
		WorkStatuses:     workStatuses,
	}
	
	// Calculate page from offset (for backward compatibility)
	if offset > 0 && limit > 0 {
		repoParams.Page = (offset / limit) + 1
	}
	
	// Get database connection with context
	timeoutCtx, cancel := context.WithTimeout(ctx, u.ReadTimeout)
	defer cancel()
	db := u.repo.WithContext(timeoutCtx)
	
	// Call the repository method
	result, err := u.repo.ListAssetsPivot(db, repoParams)
	if err != nil {
		return nil, 0, err
	}
	
	// Return assets and total for backward compatibility
	return result.Assets, result.Total, nil
}
