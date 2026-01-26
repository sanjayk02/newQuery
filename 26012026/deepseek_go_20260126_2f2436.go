package repository

import (
    "context"
    "fmt"
    "sort"
    "strings"
    "time"

    "github.com/PolygonPictures/central30-web/front/entity"
    "gorm.io/gorm"
)

type ReviewInfo struct {
    db *gorm.DB
}

func NewReviewInfo(db *gorm.DB) *ReviewInfo {
    return &ReviewInfo{db: db}
}

func (r *ReviewInfo) WithContext(ctx context.Context) *gorm.DB {
    return r.db.WithContext(ctx)
}

func (r *ReviewInfo) TransactionWithContext(ctx context.Context, fn func(*gorm.DB) error) error {
    return r.db.WithContext(ctx).Transaction(fn)
}

/* =========================
   DATA MODELS
========================= */

type phaseRow struct {
    Project           string
    Root              string
    Group1            string
    Relation          string
    LeafGroupName     string
    GroupCategoryPath string
    TopGroupNode      string
    Phase             string
    WorkStatus        string
    ApprovalStatus    string
    SubmittedAtUTC    *time.Time
}

type AssetPivot struct {
    Project           string
    Root              string
    Group1            string
    Relation          string
    LeafGroupName     string
    GroupCategoryPath string
    TopGroupNode      string

    MDLWorkStatus        string
    MDLApprovalStatus    string
    MDLSubmittedAtUTC    *time.Time
    RIGWorkStatus        string
    RIGApprovalStatus    string
    RIGSubmittedAtUTC    *time.Time
    BLDWorkStatus        string
    BLDApprovalStatus    string
    BLDSubmittedAtUTC    *time.Time
    DSNWorkStatus        string
    DSNApprovalStatus    string
    DSNSubmittedAtUTC    *time.Time
    LDVWorkStatus        string
    LDVApprovalStatus    string
    LDVSubmittedAtUTC    *time.Time
}

/* =========================
   GROUPING (GO SIDE)
========================= */

type GroupedAssetBucket struct {
    TopGroup string
    Assets   []AssetPivot
}

type SortDirection string

const (
    SortAsc  SortDirection = "ASC"
    SortDesc SortDirection = "DESC"
)

func GroupAndSortByTopNode(
    assets []AssetPivot,
    dir SortDirection,
) []GroupedAssetBucket {

    m := make(map[string][]AssetPivot)

    for _, a := range assets {
        key := a.TopGroupNode
        if key == "" {
            key = "Ungrouped"
        }
        m[key] = append(m[key], a)
    }

    result := make([]GroupedAssetBucket, 0, len(m))
    for k, v := range m {
        result = append(result, GroupedAssetBucket{
            TopGroup: k,
            Assets:   v,
        })
    }

    sortFn := func(i, j int) bool {
        if dir == SortDesc {
            return result[i].TopGroup > result[j].TopGroup
        }
        return result[i].TopGroup < result[j].TopGroup
    }

    sort.Slice(result, sortFn)
    return result
}

/* =========================
   MAIN QUERY (OPTIMIZED - NO DEADLOCKS)
========================= */

func (r *ReviewInfo) ListAssetsPivot(
    ctx context.Context,
    project, root, preferredPhase, orderKey, direction string,
    limit, offset int,
    assetNameKey string,
    approvalStatuses []string,
    workStatuses []string,
) ([]AssetPivot, int64, error) {

    // Validate required parameters
    if project == "" {
        return nil, 0, fmt.Errorf("project is required")
    }
    if root == "" {
        root = "assets"
    }

    // Set defaults
    if orderKey == "" {
        orderKey = "group_1"
    }
    if direction == "" {
        direction = "asc"
    }
    direction = strings.ToUpper(direction)
    if direction != "ASC" && direction != "DESC" {
        direction = "ASC"
    }

    // Check context before starting
    select {
    case <-ctx.Done():
        return nil, 0, ctx.Err()
    default:
        // Continue
    }

    // ---------- STEP 1: BUILD BASE FILTERS ----------
    baseQuery := r.db.WithContext(ctx).
        Table("t_review_info").
        Where("project = ? AND root = ? AND deleted = 0", project, root)

    if assetNameKey != "" {
        baseQuery = baseQuery.Where("LOWER(group_1) LIKE ?", strings.ToLower(assetNameKey)+"%")
    }

    statusWhere, statusArgs := buildPhaseAwareStatusWhere(
        preferredPhase,
        approvalStatuses,
        workStatuses,
    )
    if statusWhere != "" {
        baseQuery = baseQuery.Where(statusWhere, statusArgs...)
    }

    // ---------- STEP 2: GET TOTAL COUNT (Optimized) ----------
    // Use a separate session for count query to prevent state pollution
    countQuery := baseQuery.Session(&gorm.Session{})
    
    // Count distinct assets (project+root+group1+relation)
    var total int64
    if err := countQuery.
        Distinct("project, root, group_1, relation").
        Count(&total).Error; err != nil {
        return nil, 0, fmt.Errorf("failed to count assets: %w", err)
    }

    // Early return if no results
    if total == 0 || (limit > 0 && offset >= int(total)) {
        return []AssetPivot{}, total, nil
    }

    // ---------- STEP 3: GET PAGINATED DATA ----------
    var rows []phaseRow
    
    // Use separate session for data query
    dataQuery := baseQuery.Session(&gorm.Session{})
    
    // Build order clause
    orderClause := buildOrderClause(preferredPhase, orderKey, direction)
    
    // Execute paginated query
    if err := dataQuery.
        Select(`
            project, root, group_1 as group1, relation,
            leaf_group_name,
            group_category_path,
            top_group_node,
            phase,
            work_status,
            approval_status,
            submitted_at_utc
        `).
        Order(orderClause).
        Limit(limit).
        Offset(offset).
        Scan(&rows).Error; err != nil {
        return nil, 0, fmt.Errorf("failed to fetch asset data: %w", err)
    }

    // ---------- STEP 4: PIVOT RESULTS IN MEMORY ----------
    pivot := make(map[string]*AssetPivot)

    for _, row := range rows {
        // Create unique key for each asset
        key := fmt.Sprintf("%s|%s|%s|%s", 
            row.Project, row.Root, row.Group1, row.Relation)
            
        if _, exists := pivot[key]; !exists {
            pivot[key] = &AssetPivot{
                Project:           row.Project,
                Root:              row.Root,
                Group1:            row.Group1,
                Relation:          row.Relation,
                LeafGroupName:     row.LeafGroupName,
                GroupCategoryPath: row.GroupCategoryPath,
                TopGroupNode:      row.TopGroupNode,
            }
        }

        // Fill phase-specific fields
        p := pivot[key]
        phaseLower := strings.ToLower(row.Phase)
        
        switch phaseLower {
        case "mdl":
            p.MDLWorkStatus = row.WorkStatus
            p.MDLApprovalStatus = row.ApprovalStatus
            p.MDLSubmittedAtUTC = row.SubmittedAtUTC
        case "rig":
            p.RIGWorkStatus = row.WorkStatus
            p.RIGApprovalStatus = row.ApprovalStatus
            p.RIGSubmittedAtUTC = row.SubmittedAtUTC
        case "bld":
            p.BLDWorkStatus = row.WorkStatus
            p.BLDApprovalStatus = row.ApprovalStatus
            p.BLDSubmittedAtUTC = row.SubmittedAtUTC
        case "dsn":
            p.DSNWorkStatus = row.WorkStatus
            p.DSNApprovalStatus = row.ApprovalStatus
            p.DSNSubmittedAtUTC = row.SubmittedAtUTC
        case "ldv":
            p.LDVWorkStatus = row.WorkStatus
            p.LDVApprovalStatus = row.ApprovalStatus
            p.LDVSubmittedAtUTC = row.SubmittedAtUTC
        }
    }

    // Convert map to slice
    result := make([]AssetPivot, 0, len(pivot))
    for _, asset := range pivot {
        result = append(result, *asset)
    }

    return result, total, nil
}

/* =========================
   HELPER FUNCTIONS
========================= */

func buildPhaseAwareStatusWhere(
    preferredPhase string,
    approvalStatuses []string,
    workStatuses []string,
) (string, []interface{}) {
    
    var conditions []string
    var args []interface{}
    
    if preferredPhase != "" {
        conditions = append(conditions, "phase = ?")
        args = append(args, strings.ToUpper(preferredPhase))
    }
    
    if len(approvalStatuses) > 0 {
        placeholders := strings.Repeat("?,", len(approvalStatuses)-1) + "?"
        conditions = append(conditions, "approval_status IN ("+placeholders+")")
        for _, status := range approvalStatuses {
            args = append(args, status)
        }
    }
    
    if len(workStatuses) > 0 {
        placeholders := strings.Repeat("?,", len(workStatuses)-1) + "?"
        conditions = append(conditions, "work_status IN ("+placeholders+")")
        for _, status := range workStatuses {
            args = append(args, status)
        }
    }
    
    if len(conditions) == 0 {
        return "", nil
    }
    
    return strings.Join(conditions, " AND "), args
}

func buildOrderClause(preferredPhase, orderKey, direction string) string {
    if orderKey == "" {
        orderKey = "group_1"
    }
    
    if direction == "" {
        direction = "ASC"
    }
    
    direction = strings.ToUpper(direction)
    if direction != "ASC" && direction != "DESC" {
        direction = "ASC"
    }
    
    // If preferred phase is specified, prioritize assets in that phase
    if preferredPhase != "" {
        return fmt.Sprintf(
            "CASE WHEN LOWER(phase) = LOWER('%s') THEN 0 ELSE 1 END, %s %s",
            preferredPhase,
            orderKey,
            direction,
        )
    }
    
    return fmt.Sprintf("%s %s", orderKey, direction)
}

/* =========================
   CRUD METHODS
========================= */

func (r *ReviewInfo) List(db *gorm.DB, params *entity.ListReviewInfoParams) ([]*entity.ReviewInfo, int, error) {
    var results []*entity.ReviewInfo
    var total int64
    
    query := db.Table("t_review_info").
        Where("project = ? AND deleted = 0", params.Project)
    
    if params.Studio != nil && *params.Studio != "" {
        query = query.Where("studio = ?", *params.Studio)
    }
    
    // Get total count
    if err := query.Count(&total).Error; err != nil {
        return nil, 0, err
    }
    
    // Get paginated results
    if err := query.
        Offset(params.Offset).
        Limit(params.Limit).
        Order("created_at DESC").
        Find(&results).Error; err != nil {
        return nil, 0, err
    }
    
    return results, int(total), nil
}

func (r *ReviewInfo) Get(db *gorm.DB, params *entity.GetReviewParams) (*entity.ReviewInfo, error) {
    var result entity.ReviewInfo
    
    err := db.Table("t_review_info").
        Where("project = ? AND root = ? AND group_1 = ? AND relation = ? AND phase = ?",
            params.Project, params.Root, params.Group1, params.Relation, params.Phase).
        Where("deleted = 0").
        First(&result).Error
    
    if err != nil {
        return nil, err
    }
    
    return &result, nil
}

func (r *ReviewInfo) Create(db *gorm.DB, params *entity.CreateReviewInfoParams) (*entity.ReviewInfo, error) {
    now := time.Now().UTC()
    
    review := &entity.ReviewInfo{
        Project:        params.Project,
        Root:           params.Root,
        Group1:         params.Group1,
        Relation:       params.Relation,
        Phase:          params.Phase,
        WorkStatus:     params.WorkStatus,
        ApprovalStatus: params.ApprovalStatus,
        Studio:         params.Studio,
        SubmittedAtUTC: params.SubmittedAtUTC,
        CreatedAt:      &now,
        UpdatedAt:      &now,
    }
    
    err := db.Table("t_review_info").Create(review).Error
    if err != nil {
        return nil, err
    }
    
    return review, nil
}

func (r *ReviewInfo) Update(db *gorm.DB, params *entity.UpdateReviewInfoParams) (*entity.ReviewInfo, error) {
    var review entity.ReviewInfo
    
    // Find existing record
    err := db.Table("t_review_info").
        Where("project = ? AND root = ? AND group_1 = ? AND relation = ? AND phase = ?",
            params.Project, params.Root, params.Group1, params.Relation, params.Phase).
        Where("deleted = 0").
        First(&review).Error
    
    if err != nil {
        return nil, fmt.Errorf("review not found: %w", err)
    }
    
    // Update fields
    if params.WorkStatus != "" {
        review.WorkStatus = params.WorkStatus
    }
    if params.ApprovalStatus != "" {
        review.ApprovalStatus = params.ApprovalStatus
    }
    if params.SubmittedAtUTC != nil {
        review.SubmittedAtUTC = params.SubmittedAtUTC
    }
    
    now := time.Now().UTC()
    review.UpdatedAt = &now
    
    // Save changes
    err = db.Save(&review).Error
    if err != nil {
        return nil, err
    }
    
    return &review, nil
}

func (r *ReviewInfo) Delete(db *gorm.DB, params *entity.DeleteReviewInfoParams) error {
    // Soft delete - mark as deleted
    now := time.Now().UTC()
    
    result := db.Table("t_review_info").
        Where("project = ? AND root = ? AND group_1 = ? AND relation = ?",
            params.Project, params.Root, params.Group1, params.Relation).
        Where("deleted = 0").
        Updates(map[string]interface{}{
            "deleted":    1,
            "updated_at": now,
        })
    
    if result.Error != nil {
        return result.Error
    }
    
    if result.RowsAffected == 0 {
        return fmt.Errorf("no records found to delete")
    }
    
    return nil
}