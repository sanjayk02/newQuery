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

/* =========================
   LIST / GET / CRUD
========================= */

func (uc *ReviewInfo) List(
    ctx context.Context,
    params *entity.ListReviewInfoParams,
) ([]*entity.ReviewInfo, int, error) {

    if err := binding.Validator.ValidateStruct(params); err != nil {
        return nil, 0, err
    }

    timeoutCtx, cancel := context.WithTimeout(ctx, uc.ReadTimeout)
    defer cancel()

    // Check context before proceeding
    select {
    case <-timeoutCtx.Done():
        return nil, 0, timeoutCtx.Err()
    default:
        // Continue
    }

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

    // Check context before proceeding
    select {
    case <-timeoutCtx.Done():
        return nil, timeoutCtx.Err()
    default:
        // Continue
    }

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

    // Check context before proceeding
    select {
    case <-timeoutCtx.Done():
        return nil, timeoutCtx.Err()
    default:
        // Continue
    }

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

    // Check context before proceeding
    select {
    case <-timeoutCtx.Done():
        return nil, timeoutCtx.Err()
    default:
        // Continue
    }

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

    // Check context before proceeding
    select {
    case <-timeoutCtx.Done():
        return timeoutCtx.Err()
    default:
        // Continue
    }

    return uc.repo.TransactionWithContext(timeoutCtx, func(tx *gorm.DB) error {
        if err := uc.checkForProject(tx, params.Project); err != nil {
            return err
        }
        return uc.repo.Delete(tx, params)
    })
}

/* =========================
   ASSET PIVOT (OPTIMIZED - CONTEXT SAFE)
========================= */

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
    View             string // list | grouped
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

func (u *ReviewInfo) ListAssetsPivot(
    ctx context.Context,
    p ListAssetsPivotParams,
) (*ListAssetsPivotResult, error) {

    // Validate required parameters
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

    // Process sort parameters
    actualSortKey := p.OrderKey
    if actualSortKey == "" {
        actualSortKey = "group_1" // Default sort by asset name
    }
    
    dir := strings.ToUpper(strings.TrimSpace(p.Direction))
    if dir != "ASC" && dir != "DESC" {
        dir = "ASC" // Default ascending
    }

    // Determine view mode
    isGrouped := strings.ToLower(p.View) == "group" || strings.ToLower(p.View) == "grouped"
    
    // For grouped view, always sort by group_1 for consistent grouping
    if isGrouped {
        actualSortKey = "group_1"
    }

    limit := p.PerPage
    offset := (p.Page - 1) * p.PerPage

    // Create timeout context
    timeoutCtx, cancel := context.WithTimeout(ctx, u.ReadTimeout)
    defer cancel()

    // CRITICAL: Check context before any operations
    select {
    case <-timeoutCtx.Done():
        return nil, timeoutCtx.Err()
    default:
        // Continue
    }

    // Validate project exists
    db := u.repo.WithContext(timeoutCtx)
    if err := u.checkForProject(db, p.Project); err != nil {
        return nil, fmt.Errorf("project validation failed: %w", err)
    }

    // Check context again before DB call
    select {
    case <-timeoutCtx.Done():
        return nil, timeoutCtx.Err()
    default:
        // Continue
    }

    // ---------- LIST VIEW ----------
    if !isGrouped {
        assets, total, err := u.repo.ListAssetsPivot(
            timeoutCtx,
            p.Project,
            p.Root,
            p.PreferredPhase,
            actualSortKey,
            strings.ToLower(dir),
            limit,
            offset,
            p.AssetNameKey,
            p.ApprovalStatuses,
            p.WorkStatuses,
        )
        if err != nil {
            return nil, fmt.Errorf("failed to list asset pivot: %w", err)
        }

        // Calculate pagination metadata
        pageLast := u.calculatePageLast(total, p.PerPage)

        return &ListAssetsPivotResult{
            Assets:   assets,
            Total:    total,
            Page:     p.Page,
            PerPage:  p.PerPage,
            PageLast: pageLast,
            HasNext:  p.Page < pageLast,
            HasPrev:  p.Page > 1,
            Sort:     actualSortKey,
            Dir:      strings.ToLower(dir),
        }, nil
    }

    // ---------- GROUPED VIEW ----------
    assetsPage, total, err := u.repo.ListAssetsPivot(
        timeoutCtx,
        p.Project,
        p.Root,
        p.PreferredPhase,
        "group_1", // Always group_1 for grouped view
        strings.ToLower(dir),
        limit,
        offset,
        p.AssetNameKey,
        p.ApprovalStatuses,
        p.WorkStatuses,
    )
    if err != nil {
        return nil, fmt.Errorf("failed to list asset pivot for grouping: %w", err)
    }

    // Group assets by TopGroupNode
    grouped := repository.GroupAndSortByTopNode(
        assetsPage,
        repository.SortDirection(dir),
    )

    // Calculate pagination metadata
    pageLast := u.calculatePageLast(total, p.PerPage)

    return &ListAssetsPivotResult{
        Assets:   assetsPage,
        Groups:   grouped,
        Total:    total,
        Page:     p.Page,
        PerPage:  p.PerPage,
        PageLast: pageLast,
        HasNext:  p.Page < pageLast,
        HasPrev:  p.Page > 1,
        Sort:     "group_1", // Always group_1 for grouped view
        Dir:      strings.ToLower(dir),
    }, nil
}

// Helper method to calculate last page number
func (u *ReviewInfo) calculatePageLast(total int64, perPage int) int {
    if perPage <= 0 || total == 0 {
        return 1
    }
    
    lastPage := (total + int64(perPage) - 1) / int64(perPage)
    if lastPage < 1 {
        return 1
    }
    
    return int(lastPage)
}