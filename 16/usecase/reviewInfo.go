/* ──────────────────────────────────────────────────────────────────────────
	Module Name:
    	usecase/reviewInfo.go

	Module Description:
		Usecase layer for managing review information.

	Update and Modification History:
	* - 29-10-2025 - SanjayK PSI - Implemented dynamic filtering and sorting for latest submissions.
	* - 17-11-2025 - SanjayK PSI - Added phase-aware status filtering and sorting.
	* - 22-11-2025 - SanjayK PSI - Fixed bugs related to phase-specific filtering and sorting.
	* - 26-01-2026 - Enhanced error handling and validation.

	Functions:
	* - ListAssetsPivot: Provides filtered, phase-aware pivoted asset data.

	────────────────────────────────────────────────────────────────────────── */

package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/PolygonPictures/central30-web/front/entity"
	"github.com/PolygonPictures/central30-web/front/repository"
	"github.com/gin-gonic/gin/binding"
	"gorm.io/gorm"
)

const (
	defaultPage      = 1
	defaultPerPage   = 15
	maxPerPage       = 100
	defaultDirection = "asc"
	defaultRoot      = "assets"
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

func (uc *ReviewInfo) checkForProject(ctx context.Context, db *gorm.DB, project string) error {
	if project == "" {
		return fmt.Errorf("project name is required")
	}
	
	var count int64
	err := db.Model(&entity.ProjectInfo{}).
		Where("key_name = ?", project).
		Count(&count).
		Error
	
	if err != nil {
		return fmt.Errorf("failed to check project: %w", err)
	}
	
	if count == 0 {
		return fmt.Errorf("project not found: %s", project)
	}
	
	return nil
}

func (uc *ReviewInfo) checkForStudio(ctx context.Context, db *gorm.DB, studio string) error {
	if studio == "" {
		return fmt.Errorf("studio name is required")
	}
	
	var count int64
	err := db.Model(&entity.StudioInfo{}).
		Where("key_name = ?", studio).
		Count(&count).
		Error
	
	if err != nil {
		return fmt.Errorf("failed to check studio: %w", err)
	}
	
	if count == 0 {
		return fmt.Errorf("studio not found: %s", studio)
	}
	
	return nil
}

func (uc *ReviewInfo) List(
	ctx context.Context,
	params *entity.ListReviewInfoParams,
) ([]*entity.ReviewInfo, int, error) {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return nil, 0, fmt.Errorf("validation failed: %w", err)
	}
	
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.ReadTimeout)
	defer cancel()
	
	db := uc.repo.WithContext(timeoutCtx)
	
	if err := uc.checkForProject(ctx, db, params.Project); err != nil {
		return nil, 0, err
	}
	
	if params.Studio != nil && *params.Studio != "" {
		if err := uc.checkForStudio(ctx, db, *params.Studio); err != nil {
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
		return nil, fmt.Errorf("validation failed: %w", err)
	}
	
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.ReadTimeout)
	defer cancel()
	
	db := uc.repo.WithContext(timeoutCtx)
	
	if err := uc.checkForProject(ctx, db, params.Project); err != nil {
		return nil, err
	}
	
	return uc.repo.Get(db, params)
}

func (uc *ReviewInfo) Create(
	ctx context.Context,
	params *entity.CreateReviewInfoParams,
) (*entity.ReviewInfo, error) {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}
	
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.WriteTimeout)
	defer cancel()
	
	db := uc.repo.WithContext(timeoutCtx)
	
	if err := uc.checkForProject(ctx, db, params.Project); err != nil {
		return nil, err
	}
	
	if err := uc.checkForStudio(ctx, db, params.Studio); err != nil {
		return nil, err
	}
	
	var e *entity.ReviewInfo
	if err := uc.repo.TransactionWithContext(timeoutCtx, func(tx *gorm.DB) error {
		var err error
		e, err = uc.repo.Create(tx, params)
		return err
	}); err != nil {
		return nil, fmt.Errorf("failed to create review: %w", err)
	}

	// Create associated comment
	if err := uc.createReviewComment(timeoutCtx, params, e); err != nil {
		// Log the error but don't fail the review creation
		fmt.Printf("Warning: failed to create review comment: %v\n", err)
	}

	return e, nil
}

func (uc *ReviewInfo) createReviewComment(
	ctx context.Context,
	params *entity.CreateReviewInfoParams,
	review *entity.ReviewInfo,
) error {
	var user string
	if params.CreatedBy != nil {
		user = *params.CreatedBy
	}

	commentdata := make([]map[string]interface{}, 0, len(params.ReviewComments))
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

	docMetadata := map[string]interface{}{
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
		"review_id":            review.ID,
	}

	ctxWithUser := context.WithValue(ctx, entity.KeyUser, user)
	_, err := uc.docRepo.CreateDocument(ctxWithUser, params.Project, "comment", docMetadata)
	
	return err
}

func (uc *ReviewInfo) Update(
	ctx context.Context,
	params *entity.UpdateReviewInfoParams,
) (*entity.ReviewInfo, error) {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}
	
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.WriteTimeout)
	defer cancel()
	
	db := uc.repo.WithContext(timeoutCtx)
	
	if err := uc.checkForProject(ctx, db, params.Project); err != nil {
		return nil, err
	}
	
	var e *entity.ReviewInfo
	if err := uc.repo.TransactionWithContext(timeoutCtx, func(tx *gorm.DB) error {
		var err error
		e, err = uc.repo.Update(tx, params)
		return err
	}); err != nil {
		return nil, fmt.Errorf("failed to update review: %w", err)
	}
	
	return e, nil
}

func (uc *ReviewInfo) Delete(
	ctx context.Context,
	params *entity.DeleteReviewInfoParams,
) error {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}
	
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.WriteTimeout)
	defer cancel()
	
	return uc.repo.TransactionWithContext(timeoutCtx, func(tx *gorm.DB) error {
		if err := uc.checkForProject(ctx, tx, params.Project); err != nil {
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
		return nil, 0, fmt.Errorf("validation failed: %w", err)
	}
	
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.ReadTimeout)
	defer cancel()
	
	db := uc.repo.WithContext(timeoutCtx)
	
	if err := uc.checkForProject(ctx, db, params.Project); err != nil {
		return nil, 0, err
	}
	
	if params.Studio != nil && *params.Studio != "" {
		if err := uc.checkForStudio(ctx, db, *params.Studio); err != nil {
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
		return nil, fmt.Errorf("validation failed: %w", err)
	}
	
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.ReadTimeout)
	defer cancel()
	
	db := uc.repo.WithContext(timeoutCtx)
	
	if err := uc.checkForProject(ctx, db, params.Project); err != nil {
		return nil, err
	}
	
	if params.Studio != nil && *params.Studio != "" {
		if err := uc.checkForStudio(ctx, db, *params.Studio); err != nil {
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
		return nil, fmt.Errorf("validation failed: %w", err)
	}
	
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.ReadTimeout)
	defer cancel()
	
	db := uc.repo.WithContext(timeoutCtx)
	
	if err := uc.checkForProject(ctx, db, params.Project); err != nil {
		return nil, err
	}
	
	if params.Studio != nil && *params.Studio != "" {
		if err := uc.checkForStudio(ctx, db, *params.Studio); err != nil {
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

// ValidateAndNormalize validates and normalizes the parameters
func (p *ListAssetsPivotParams) ValidateAndNormalize() error {
	if p.Project == "" {
		return fmt.Errorf("project is required")
	}
	
	if p.Root == "" {
		p.Root = defaultRoot
	}
	
	if p.PerPage <= 0 {
		p.PerPage = defaultPerPage
	} else if p.PerPage > maxPerPage {
		p.PerPage = maxPerPage
	}
	
	if p.Page <= 0 {
		p.Page = defaultPage
	}
	
	p.Direction = strings.ToUpper(strings.TrimSpace(p.Direction))
	if p.Direction != "ASC" && p.Direction != "DESC" {
		p.Direction = defaultDirection
	}
	
	return nil
}

// ListAssetsPivot provides filtered, phase-aware pivoted asset data.
func (u *ReviewInfo) ListAssetsPivot(ctx context.Context, p ListAssetsPivotParams) (*ListAssetsPivotResult, error) {
	if err := p.ValidateAndNormalize(); err != nil {
		return nil, fmt.Errorf("invalid parameters: %w", err)
	}
	
	timeoutCtx, cancel := context.WithTimeout(ctx, u.ReadTimeout)
	defer cancel()
	
	db := u.repo.WithContext(timeoutCtx)
	if err := u.checkForProject(ctx, db, p.Project); err != nil {
		return nil, fmt.Errorf("project validation failed: %w", err)
	}
	
	limit := p.PerPage
	offset := (p.Page - 1) * p.PerPage
	
	isGroupedView := p.View == "group" || p.View == "grouped" || p.View == "category"
	
	// ---------- LIST VIEW ----------
	if !isGroupedView {
		assets, total, err := u.repo.ListAssetsPivot(
			ctx,
			p.Project,
			p.Root,
			p.PreferredPhase,
			p.OrderKey,
			strings.ToLower(p.Direction),
			limit,
			offset,
			p.AssetNameKey,
			p.ApprovalStatuses,
			p.WorkStatuses,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to list assets: %w", err)
		}
		
		pageLast := calculateLastPage(total, p.PerPage)
		
		return &ListAssetsPivotResult{
			Assets:   assets,
			Groups:   nil,
			Total:    total,
			Page:     p.Page,
			PerPage:  p.PerPage,
			PageLast: pageLast,
			HasNext:  offset+limit < int(total),
			HasPrev:  p.Page > 1,
			Sort:     p.OrderKey,
			Dir:      strings.ToLower(p.Direction),
		}, nil
	}
	
	// ---------- GROUPED VIEW ----------
	const allLimit = 1000 // Reduced from 1,000,000 for performance
	
	assetsAll, total, err := u.repo.ListAssetsPivot(
		ctx,
		p.Project,
		p.Root,
		p.PreferredPhase,
		"group_1",
		"asc",
		allLimit,
		0,
		p.AssetNameKey,
		p.ApprovalStatuses,
		p.WorkStatuses,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list assets for grouping: %w", err)
	}
	
	groupedAll := repository.GroupAndSortByTopNode(assetsAll, repository.SortDirection(p.Direction))
	
	flat := make([]repository.AssetPivot, 0, len(assetsAll))
	for _, g := range groupedAll {
		flat = append(flat, g.Items...)
	}
	
	totalAssets := len(flat)
	if totalAssets == 0 {
		return u.emptyGroupedResult(p), nil
	}
	
	start, end := calculatePaginationBounds(offset, limit, totalAssets)
	pageSlice := flat[start:end]
	
	pageGroups := repository.GroupAndSortByTopNode(pageSlice, repository.SortDirection(p.Direction))
	
	pageLast := calculateLastPage(int64(totalAssets), p.PerPage)
	
	return &ListAssetsPivotResult{
		Assets:   pageSlice,
		Groups:   pageGroups,
		Total:    total,
		Page:     p.Page,
		PerPage:  p.PerPage,
		PageLast: pageLast,
		HasNext:  offset+limit < totalAssets,
		HasPrev:  p.Page > 1,
		Sort:     "group_1",
		Dir:      strings.ToLower(p.Direction),
	}, nil
}

func (u *ReviewInfo) emptyGroupedResult(p ListAssetsPivotParams) *ListAssetsPivotResult {
	return &ListAssetsPivotResult{
		Assets:   []repository.AssetPivot{},
		Groups:   []repository.GroupedAssetBucket{},
		Total:    0,
		Page:     p.Page,
		PerPage:  p.PerPage,
		PageLast: 0,
		HasNext:  false,
		HasPrev:  false,
		Sort:     "group_1",
		Dir:      strings.ToLower(p.Direction),
	}
}

// Helper functions
func calculateLastPage(total int64, perPage int) int {
	if total == 0 {
		return 0
	}
	return int((total + int64(perPage) - 1) / int64(perPage))
}

func calculatePaginationBounds(offset, limit, total int) (start, end int) {
	start = offset
	if start > total {
		start = total
	}
	
	end = start + limit
	if end > total {
		end = total
	}
	
	return start, end
}
