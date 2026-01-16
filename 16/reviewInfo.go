/* ──────────────────────────────────────────────────────────────────────────
	Module Name:
    	reviewInfo/reviewInfo.go

	Module Description:
		Repository for managing review information in the database.
	Details:
	- Implements CRUD operations for review information.
	- Supports listing assets and their review information.
	- Provides functions for counting and listing latest submissions with dynamic filtering and sorting.

	Update and Modification History:
	* - 29-10-2025 - SanjayK PSI - Implemented dynamic filtering and sorting for latest submissions.
	* - 17-11-2025 - SanjayK PSI - Added phase-aware status filtering and sorting.
	* - 22-11-2025 - SanjayK PSI - Fixed bugs related to phase-specific filtering and sorting.
	* - 26-01-2026 - Converted ListAssetsPivot to use GORM query builder

	Functions:
	* - List: Lists review information based on provided parameters.
	* - Get: Retrieves a specific review information record.
	* - Create: Creates a new review information record.
	* - Update: Updates an existing review information record.
	* - Delete: Marks a review information record as deleted.
	* - ListAssets: Lists unique assets based on review information.
	* - ListShotReviewInfos: Lists review information for a specific shot.
	* - ListAssetReviewInfos: Lists review information for a specific asset.
	* - CountLatestSubmissions: Counts latest submissions with dynamic filtering.
	* - ListLatestSubmissionsDynamic: Lists latest submissions with dynamic filtering and sorting.
	* - buildPhaseAwareStatusWhere: Constructs a WHERE clause for phase-aware status filtering.
	* - buildOrderClause: Constructs an ORDER BY clause based on sorting parameters.
	* - ListAssetsPivot: Lists pivoted assets with filtering and sorting options.

	────────────────────────────────────────────────────────────────────────── */

package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/PolygonPictures/central30-web/front/entity"
	"github.com/PolygonPictures/central30-web/front/repository/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ReviewInfo struct {
	db *gorm.DB
}

func NewReviewInfo(db *gorm.DB) (*ReviewInfo, error) {
	info := model.ReviewInfo{}

	//Specification change: https:jira.ppi.co.jp/browse/POTOO-2406
	migrator := db.Migrator()
	if migrator.HasTable(&info) && !migrator.HasColumn(&info, "take_path") {
		if err := migrator.RenameColumn(&info, "path", "take_path"); err != nil {
			return nil, err
		}
	}

	if err := db.AutoMigrate(&info); err != nil {
		return nil, err
	}

	return &ReviewInfo{
		db: db,
	}, nil
}

func (r *ReviewInfo) WithContext(ctx context.Context) *gorm.DB {
	return r.db.WithContext(ctx)
}

func (r *ReviewInfo) TransactionWithContext(
	ctx context.Context,
	fc func(tx *gorm.DB) error,
	opts ...*sql.TxOptions,
) error {
	db := r.WithContext(ctx)
	return db.Transaction(fc, opts...)
}

func (r *ReviewInfo) List(
	db *gorm.DB,
	params *entity.ListReviewInfoParams,
) ([]*entity.ReviewInfo, int, error) {
	stmt := db
	for i, g := range params.Group {
		stmt = stmt.Where(fmt.Sprintf("group_%d = ?", i+1), g)
	}
	stmt = stmt.Where("`project` = ?", params.Project)
	if params.Studio != nil {
		stmt = stmt.Where("`studio` = ?", *params.Studio)
	}
	if params.TaskID != nil {
		stmt = stmt.Where("`task_id` = ?", *params.TaskID)
	}
	if params.SubtaskID != nil {
		stmt = stmt.Where("`subtask_id` = ?", *params.SubtaskID)
	}
	if params.Root != nil {
		stmt = stmt.Where("`root` = ?", *params.Root)
	}
	for i, g := range params.Group {
		stmt = stmt.Where(fmt.Sprintf("`groups`->\"$[%d]\" = ?", i), g)
	}
	if params.Relation != nil {
		stmt = stmt.Where("relation IN (?)", params.Relation)
	}
	if params.Phase != nil {
		stmt = stmt.Where("phase IN (?)", params.Phase)
	}
	if params.Component != nil {
		stmt = stmt.Where("`component` = ?", *params.Component)
	}
	if params.Take != nil {
		stmt = stmt.Where("`take` = ?", *params.Take)
	}

	order := "`id` desc"
	if params.OrderBy != nil {
		order = *params.OrderBy
	}
	showDeleted := false
	if params.ModifiedSince != nil {
		stmt = stmt.Where("`modified_at_utc` >= ?", *params.ModifiedSince)
		order = "`modified_at_utc` asc"
		showDeleted = true
	} else {
		stmt.Where("`deleted` = ?", 0)
	}

	var total int64
	var m model.ReviewInfo
	if err := stmt.Model(&m).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var models []*model.ReviewInfo
	perPage := params.GetPerPage()
	offset := perPage * (params.GetPage() - 1)
	if err := stmt.Order(
		order,
	).Limit(perPage).Offset(offset).Find(&models).Error; err != nil {
		return nil, 0, err
	}

	var entities []*entity.ReviewInfo
	for _, m := range models {
		entities = append(entities, m.Entity(showDeleted))
	}
	return entities, int(total), nil
}

func (r *ReviewInfo) Get(
	db *gorm.DB,
	params *entity.GetReviewParams,
) (*entity.ReviewInfo, error) {
	var m model.ReviewInfo
	if err := db.Where(
		"`deleted` = ?", 0,
	).Where(
		"`project` = ?", params.Project,
	).Where(
		"`id` = ?", params.ID,
	).Take(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, entity.ErrRecordNotFound
		}
		return nil, err
	}
	return m.Entity(false), nil
}

func (r *ReviewInfo) Create(
	tx *gorm.DB,
	params *entity.CreateReviewInfoParams,
) (*entity.ReviewInfo, error) {
	m := model.NewReviewInfo(params)
	if err := tx.Create(m).Error; err != nil {
		return nil, err
	}
	return m.Entity(false), nil
}

func (r *ReviewInfo) Update(
	tx *gorm.DB,
	params *entity.UpdateReviewInfoParams,
) (*entity.ReviewInfo, error) {
	now := time.Now().UTC()
	modifiedBy := ""
	if params.ModifiedBy != nil {
		modifiedBy = *params.ModifiedBy
	}
	var m model.ReviewInfo
	if err := tx.Where(
		"`deleted` = ?", 0,
	).Where(
		"`project` = ?", params.Project,
	).Where(
		"`id` = ?", params.ID,
	).Take(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, entity.ErrRecordNotFound
		}
		return nil, err
	}
	var modified = false
	if params.ApprovalStatus != nil {
		m.ApprovalStatus = *params.ApprovalStatus
		m.ApprovalStatusUpdatedAtUtc = now
		modified = true
	}
	if params.ApprovalStatusUpdatedUser != nil {
		m.ApprovalStatusUpdatedUser = *params.ApprovalStatusUpdatedUser
		m.ApprovalStatusUpdatedAtUtc = now
		modified = true
	}
	if params.WorkStatus != nil {
		m.WorkStatus = *params.WorkStatus
		m.WorkStatusUpdatedAtUtc = now
		modified = true
	}
	if params.WorkStatusUpdatedUser != nil {
		m.WorkStatusUpdatedUser = *params.WorkStatusUpdatedUser
		m.WorkStatusUpdatedAtUtc = now
		modified = true
	}
	if !modified {
		return nil, errors.New("no value is given to change")
	}
	m.ModifiedAtUTC = now
	m.ModifiedBy = modifiedBy
	return m.Entity(false), tx.Save(m).Error
}

func (r *ReviewInfo) Delete(
	tx *gorm.DB,
	params *entity.DeleteReviewInfoParams,
) error {
	now := time.Now().UTC()
	var modifiedBy string
	if params.ModifiedBy != nil {
		modifiedBy = *params.ModifiedBy
	}
	var m model.ReviewInfo
	if err := tx.Where(
		"`deleted` = ?", 0,
	).Where(
		"`project` = ?", params.Project,
	).Where(
		"`id` = ?", params.ID,
	).Take(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return entity.ErrRecordNotFound
		}
		return err
	}
	m.Deleted = m.ID
	m.ModifiedAtUTC = now
	m.ModifiedBy = modifiedBy
	return tx.Save(m).Error
}

func (r *ReviewInfo) ListAssets(
	db *gorm.DB,
	params *entity.AssetListParams,
) ([]*entity.Asset, int, error) {
	stmt := db.Model(
		&ReviewInfo{},
	).Where(
		"deleted = ?", 0,
	).Where(
		"project = ?", params.Project,
	).Where(
		"root = ?", "assets",
	).Group(
		"project",
	).Group(
		"root",
	).Group(
		"group_1",
	).Group(
		"relation",
	)

	var total int64
	if err := stmt.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	stmt = stmt.Order(
		"group_1",
	).Order(
		"relation",
	)

	var reviews []*model.ReviewInfo
	perPage := params.GetPerPage()
	offset := perPage * (params.GetPage() - 1)
	if err := stmt.Select(
		"project", "root", "group_1", "relation",
	).Limit(perPage).Offset(offset).Find(&reviews).Error; err != nil {
		return nil, 0, err
	}

	assets := make([]*entity.Asset, len(reviews))
	for i, review := range reviews {
		assets[i] = &entity.Asset{
			Name:     review.Group1,
			Relation: review.Relation,
		}
	}
	return assets, int(total), nil
}

func (r *ReviewInfo) ListAssetReviewInfos(
	db *gorm.DB,
	params *entity.AssetReviewInfoListParams,
) ([]*entity.ReviewInfo, error) {
	stmtA := db.Select(
		"project",
		"root",
		"group_1",
		"relation",
		"phase",
		"MAX(modified_at_utc) AS modified_at_utc",
	).Model(
		&model.ReviewInfo{},
	).Where(
		"project = ?", params.Project,
	).Where(
		"root = ?", "assets",
	).Where(
		"group_1 = ?", params.Asset,
	).Where(
		"relation = ?", params.Relation,
	).Where(
		"deleted = ?", 0,
	).Group(
		"project",
	).Group(
		"root",
	).Group(
		"group_1",
	).Group(
		"relation",
	).Group(
		"phase",
	)

	stmtB := db.Select(
		"*",
	).Model(
		&model.ReviewInfo{},
	).Where(
		"project = ?", params.Project,
	).Where(
		"root = ?", "assets",
	).Where(
		"group_1 = ?", params.Asset,
	).Where(
		"relation = ?", params.Relation,
	).Where(
		"deleted = ?", 0,
	)

	stmt := db.Select(
		"b.*",
	).Table(
		"(?) AS a", stmtA,
	).Joins(
		"LEFT OUTER JOIN (?) AS b ON a.project = b.project AND a.root = b.root AND a.group_1 = b.group_1 AND a.relation = b.relation AND a.phase = b.phase AND a.modified_at_utc = b.modified_at_utc", stmtB,
	)

	var reviews []*model.ReviewInfo
	if err := stmt.Scan(&reviews).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	reviewInfos := make([]*entity.ReviewInfo, len(reviews))
	for i, review := range reviews {
		reviewInfos[i] = review.Entity(false)
	}
	return reviewInfos, nil
}

func (r *ReviewInfo) ListShotReviewInfos(
	db *gorm.DB,
	params *entity.ShotReviewInfoListParams,
) ([]*entity.ReviewInfo, error) {
	stmtA := db.Select(
		"project",
		"root",
		"group_1",
		"group_2",
		"group_3",
		"relation",
		"phase",
		"MAX(modified_at_utc) AS modified_at_utc",
	).Model(
		&model.ReviewInfo{},
	).Where(
		"project = ?", params.Project,
	).Where(
		"root = ?", "shots",
	).Where(
		"group_1 = ?", params.Groups[0],
	).Where(
		"group_2 = ?", params.Groups[1],
	).Where(
		"group_3 = ?", params.Groups[2],
	).Where(
		"relation = ?", params.Relation,
	).Where(
		"deleted = ?", 0,
	).Group(
		"project",
	).Group(
		"root",
	).Group(
		"group_1",
	).Group(
		"group_2",
	).Group(
		"group_3",
	).Group(
		"relation",
	).Group(
		"phase",
	)

	stmtB := db.Select(
		"*",
	).Model(
		&model.ReviewInfo{},
	).Where(
		"project = ?", params.Project,
	).Where(
		"root = ?", "shots",
	).Where(
		"group_1 = ?", params.Groups[0],
	).Where(
		"group_2 = ?", params.Groups[1],
	).Where(
		"group_3 = ?", params.Groups[2],
	).Where(
		"relation = ?", params.Relation,
	).Where(
		"deleted = ?", 0,
	)

	stmt := db.Select(
		"b.*",
	).Table(
		"(?) AS a", stmtA,
	).Joins(
		"LEFT OUTER JOIN (?) AS b ON a.project = b.project AND a.root = b.root AND a.group_1 = b.group_1 AND a.group_2 = b.group_2 AND a.group_3 = b.group_3 AND a.relation = b.relation AND a.phase = b.phase AND a.modified_at_utc = b.modified_at_utc", stmtB,
	)

	var reviews []*model.ReviewInfo
	if err := stmt.Scan(&reviews).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	reviewInfos := make([]*entity.ReviewInfo, len(reviews))
	for i, review := range reviews {
		reviewInfos[i] = review.Entity(false)
	}
	return reviewInfos, nil
}

// ========================================================================
// ========= Asset Review Pivot Listing ===================================
// ========================================================================

type LatestSubmissionRow struct {
	Root           string     `json:"root"              gorm:"column:root"`
	Project        string     `json:"project"           gorm:"column:project"`
	Group1         string     `json:"group_1"           gorm:"column:group_1"`
	Relation       string     `json:"relation"          gorm:"column:relation"`
	Phase          string     `json:"phase"             gorm:"column:phase"`
	SubmittedAtUTC *time.Time `json:"submitted_at_utc"  gorm:"column:submitted_at_utc"`
}

// ---- Pivot result ----
// Used by UI for both List View and Group Category View.
type AssetPivot struct {
	Root     string `json:"root"`
	Project  string `json:"project"`
	Group1   string `json:"group_1"`
	Relation string `json:"relation"`

	// Grouping info
	LeafGroupName     string `json:"leaf_group_name"`
	GroupCategoryPath string `json:"group_category_path"`
	TopGroupNode      string `json:"top_group_node"`

	MDLWorkStatus     *string    `json:"mdl_work_status"`
	MDLApprovalStatus *string    `json:"mdl_approval_status"`
	MDLSubmittedAtUTC *time.Time `json:"mdl_submitted_at_utc"`

	RIGWorkStatus     *string    `json:"rig_work_status"`
	RIGApprovalStatus *string    `json:"rig_approval_status"`
	RIGSubmittedAtUTC *time.Time `json:"rig_submitted_at_utc"`

	BLDWorkStatus     *string    `json:"bld_work_status"`
	BLDApprovalStatus *string    `json:"bld_approval_status"`
	BLDSubmittedAtUTC *time.Time `json:"bld_submitted_at_utc"`

	DSNWorkStatus     *string    `json:"dsn_work_status"`
	DSNApprovalStatus *string    `json:"dsn_approval_status"`
	DSNSubmittedAtUTC *time.Time `json:"dsn_submitted_at_utc"`

	LDVWorkStatus     *string    `json:"ldv_work_status"`
	LDVApprovalStatus *string    `json:"ldv_approval_status"`
	LDVSubmittedAtUTC *time.Time `json:"ldv_submitted_at_utc"`
}

// ========================================================================
// ===================== GROUP CATEGORY SUPPORT ==========================
// ========================================================================

type SortDirection string

const (
	SortASC  SortDirection = "ASC"
	SortDESC SortDirection = "DESC"
)

type GroupedAssetBucket struct {
	TopGroupNode string       `json:"top_group_node"` // camera / character / prop / ...
	ItemCount    int          `json:"item_count"`
	Items        []AssetPivot `json:"items"`
	TotalCount   *int         `json:"total_count"` // optional total count across pages

}

func GroupAndSortByTopNode(rows []AssetPivot, dir SortDirection) []GroupedAssetBucket {
	grouped := make(map[string][]AssetPivot)
	order := make([]string, 0)

	// group and collect TopGroupNode keys
	for _, row := range rows {
		key := strings.TrimSpace(row.TopGroupNode)
		if key == "" {
			key = "Unassigned" // represents NULL / no group
		}
		if _, exists := grouped[key]; !exists {
			grouped[key] = []AssetPivot{}
			order = append(order, key)
		}
		grouped[key] = append(grouped[key], row)
	}

	// Group header order:
	// - ALWAYS alphabetical A→Z
	// - "Unassigned" ALWAYS last (no more "unassignedFirst")
	isUnassigned := func(s string) bool {
		return strings.EqualFold(strings.TrimSpace(s), "unassigned")
	}

	sort.Slice(order, func(i, j int) bool {
		ai := strings.TrimSpace(order[i])
		aj := strings.TrimSpace(order[j])

		aui := isUnassigned(ai)
		auj := isUnassigned(aj)

		// Unassigned always last
		if aui && !auj {
			return false
		}
		if !aui && auj {
			return true
		}

		// Always A→Z (case-insensitive)
		return strings.ToLower(ai) < strings.ToLower(aj)
	})

	// sort children inside each group by Group1 using requested dir
	for _, key := range order {
		children := grouped[key]
		sort.SliceStable(children, func(i, j int) bool {
			gi := strings.ToLower(children[i].Group1)
			gj := strings.ToLower(children[j].Group1)

			if dir == SortDESC {
				return gi > gj
			}
			return gi < gj
		})
		grouped[key] = children
	}

	result := make([]GroupedAssetBucket, 0, len(order))
	for _, key := range order {
		result = append(result, GroupedAssetBucket{
			TopGroupNode: key,
			Items:        grouped[key],
		})
	}
	return result
}

// ========================================================================
// ========================= FILTER / ORDER HELPERS ======================
// ========================================================================

// preferredPhase is ignored in filtering, only used for sort priority elsewhere.
func buildPhaseAwareStatusWhere(_ string, approvalStatuses, workStatuses []string) (string, []any) {
	buildIn := func(col string, vals []string) (string, []any) {
		if len(vals) == 0 {
			return "", nil
		}
		ph := strings.Repeat("?,", len(vals))
		ph = ph[:len(ph)-1]

		args := make([]any, len(vals))
		for i, v := range vals {
			args[i] = strings.ToLower(strings.TrimSpace(v))
		}

		return fmt.Sprintf("LOWER(%s) IN (%s)", col, ph), args
	}

	clauses := []string{}
	args := []any{}

	if c, a := buildIn("approval_status", approvalStatuses); c != "" {
		clauses = append(clauses, "("+c+")")
		args = append(args, a...)
	}
	if c, a := buildIn("work_status", workStatuses); c != "" {
		clauses = append(clauses, "("+c+")")
		args = append(args, a...)
	}

	if len(clauses) == 0 {
		return "", nil
	}
	return " AND " + strings.Join(clauses, " AND "), args
}

// ORDER BY builder, safe because key is white-listed in switch and dir normalized.
func buildOrderClause(alias, key, dir string) string {
	dir = strings.ToUpper(strings.TrimSpace(dir))
	if dir != "ASC" && dir != "DESC" {
		dir = "ASC"
	}

	col := func(c string) string {
		if alias == "" {
			return c
		}
		return alias + "." + c
	}

	switch key {
	// generic columns
	case "submitted_at_utc", "modified_at_utc", "phase":
		return col(key) + " " + dir

	// name / relation
	case "group1_only":
		// PRIMARY for LIST VIEW:
		// ORDER BY group_1, relation, submitted_at_utc (NULL last)
		return fmt.Sprintf(
			"LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir,
			col("relation"),
			col("submitted_at_utc"),
			col("submitted_at_utc"), dir,
		)

	case "relation_only":
		return fmt.Sprintf(
			"LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("relation"), dir,
			col("group_1"),
			col("submitted_at_utc"),
			col("submitted_at_utc"), dir,
		)

	case "group_rel_submitted":
		return fmt.Sprintf(
			"LOWER(%s) ASC, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"),
			col("relation"),
			col("submitted_at_utc"),
			col("submitted_at_utc"), dir,
		)

	// phase-specific submitted date (NULL last)
	case "mdl_submitted", "rig_submitted", "bld_submitted", "dsn_submitted", "ldv_submitted":
		return fmt.Sprintf(
			"(%s IS NULL) ASC, %s %s, LOWER(%s) ASC",
			col("submitted_at_utc"),
			col("submitted_at_utc"), dir,
			col("group_1"),
		)

	// work columns (alphabetical, NULL last)
	case "mdl_work", "rig_work", "bld_work", "dsn_work", "ldv_work", "work_status":
		return fmt.Sprintf(
			"(%s IS NULL) ASC, LOWER(%s) %s, LOWER(%s) ASC",
			col("work_status"),
			col("work_status"), dir,
			col("group_1"),
		)

	// approval columns (alphabetical, NULL last)
	case "mdl_appr", "rig_appr", "bld_appr", "dsn_appr", "ldv_appr":
		return fmt.Sprintf(
			"(%s IS NULL) ASC, LOWER(%s) %s, LOWER(%s) ASC",
			col("approval_status"),
			col("approval_status"), dir,
			col("group_1"),
		)

	// default: group_1 + relation + submitted_at_utc
	default:
		return fmt.Sprintf(
			"LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir,
			col("relation"),
			col("submitted_at_utc"),
			col("submitted_at_utc"), dir,
		)
	}
}

// ========================================================================
// ========================= GORM QUERIES ================================
// ========================================================================

// CountLatestSubmissions returns total asset count (for pagination) after filters.
func (r *ReviewInfo) CountLatestSubmissions(
	ctx context.Context,
	project, root, assetNameKey string,
	preferredPhase string,
	approvalStatuses []string,
	workStatuses []string,
) (int64, error) {
	if project == "" {
		return 0, fmt.Errorf("project is required")
	}
	if root == "" {
		root = "assets"
	}

	db := r.db.WithContext(ctx)

	// Create subquery for latest phase records
	latestPhase := db.Model(&model.ReviewInfo{}).
		Select(`
			project,
			root,
			group_1,
			relation,
			phase,
			work_status,
			approval_status,
			submitted_at_utc,
			modified_at_utc,
			ROW_NUMBER() OVER (
				PARTITION BY project, root, group_1, relation, phase
				ORDER BY modified_at_utc DESC
			) AS rn
		`).
		Where("project = ?", project).
		Where("root = ?", root).
		Where("deleted = 0")

	if strings.TrimSpace(assetNameKey) != "" {
		latestPhase = latestPhase.Where("LOWER(group_1) LIKE ?", 
			strings.ToLower(strings.TrimSpace(assetNameKey)) + "%")
	}

	// Create CTE for filtered assets
	filteredAssets := db.Model(&model.ReviewInfo{}).
		Select("project, root, group_1, relation").
		Table("(?) AS latest_phase", latestPhase).
		Where("rn = 1")

	// Apply status filters
	if len(approvalStatuses) > 0 || len(workStatuses) > 0 {
		statusWhere, statusArgs := buildPhaseAwareStatusWhere(preferredPhase, approvalStatuses, workStatuses)
		if statusWhere != "" {
			filteredAssets = filteredAssets.Where(statusWhere[4:], statusArgs...) // Remove "AND "
		}
	}

	filteredAssets = filteredAssets.Group("project, root, group_1, relation")

	// Count distinct assets
	var total int64
	err := db.Table("(?) AS x", filteredAssets).Count(&total).Error
	if err != nil {
		return 0, fmt.Errorf("CountLatestSubmissions: %w", err)
	}

	return total, nil
}

// ListLatestSubmissionsDynamic returns one "primary" row per asset for a page.
func (r *ReviewInfo) ListLatestSubmissionsDynamic(
	ctx context.Context,
	project string,
	root string,
	preferredPhase string,
	orderKey string,
	direction string,
	limit, offset int,
	assetNameKey string,
	approvalStatuses []string,
	workStatuses []string,
) ([]LatestSubmissionRow, error) {
	if project == "" {
		return nil, fmt.Errorf("project is required")
	}
	if root == "" {
		root = "assets"
	}
	if limit <= 0 {
		limit = 60
	}
	if offset < 0 {
		offset = 0
	}

	// phaseGuard: 1 = no phase bias, 0 = prefer preferredPhase
	phaseGuard := 0
	if preferredPhase == "" || strings.EqualFold(preferredPhase, "none") {
		phaseGuard = 1
	}

	orderClauseWindow := buildOrderClause("", orderKey, direction)
	orderClauseInner := buildOrderClause("b", orderKey, direction)

	db := r.db.WithContext(ctx)

	// 1. Create keys subquery
	latestPhaseKeys := db.Model(&model.ReviewInfo{}).
		Select(`
			project,
			root,
			group_1,
			relation,
			phase,
			work_status,
			approval_status,
			submitted_at_utc,
			modified_at_utc,
			ROW_NUMBER() OVER (
				PARTITION BY project, root, group_1, relation, phase
				ORDER BY modified_at_utc DESC
			) AS rn
		`).
		Where("project = ?", project).
		Where("root = ?", root).
		Where("deleted = 0")

	if strings.TrimSpace(assetNameKey) != "" {
		latestPhaseKeys = latestPhaseKeys.Where("LOWER(group_1) LIKE ?", 
			strings.ToLower(strings.TrimSpace(assetNameKey)) + "%")
	}

	keysSubquery := db.Model(&model.ReviewInfo{}).
		Select("project, root, group_1, relation").
		Table("(?) AS latest_phase", latestPhaseKeys).
		Where("rn = 1")

	// Apply status filters to keys subquery
	if len(approvalStatuses) > 0 || len(workStatuses) > 0 {
		statusWhere, statusArgs := buildPhaseAwareStatusWhere(preferredPhase, approvalStatuses, workStatuses)
		if statusWhere != "" {
			keysSubquery = keysSubquery.Where(statusWhere[4:], statusArgs...)
		}
	}

	keysSubquery = keysSubquery.Group("project, root, group_1, relation")

	// 2. Create main query using GORM
	phaseMaxQuery := db.Model(&model.ReviewInfo{}).
		Select(`
			project,
			root,
			group_1,
			relation,
			phase,
			MAX(modified_at_utc) AS modified_at_utc
		`).
		Where("project = ?", project).
		Where("root = ?", root).
		Where("deleted = 0").
		Group("project, root, group_1, relation, phase")

	phaseDataQuery := db.Model(&model.ReviewInfo{}).
		Select(`
			root,
			project,
			group_1,
			phase,
			relation,
			work_status,
			approval_status,
			submitted_at_utc,
			modified_at_utc
		`).
		Where("project = ?", project).
		Where("root = ?", root).
		Where("deleted = 0")

	// Build the main ordered query
	orderedQuery := db.Model(&model.ReviewInfo{}).
		Select("b.*").
		Table("(?) AS a", phaseMaxQuery).
		Joins("LEFT JOIN (?) AS b ON a.project = b.project AND a.root = b.root AND a.group_1 = b.group_1 AND a.relation = b.relation AND a.phase = b.phase AND a.modified_at_utc = b.modified_at_utc", phaseDataQuery).
		Joins("INNER JOIN (?) AS fk ON b.project = fk.project AND b.root = fk.root AND b.group_1 = fk.group_1 AND b.relation = fk.relation", keysSubquery).
		Order(orderClauseInner)

	// Apply window ordering and ranking
	rankedQuery := db.Model(&model.ReviewInfo{}).
		Select(`
			b.*,
			ROW_NUMBER() OVER (
				PARTITION BY b.root, b.project, b.group_1, b.relation
				ORDER BY
					CASE
						WHEN ? = 1 THEN 0
						WHEN b.phase = ? THEN 0
						ELSE 1
					END,
					LOWER(b.group_1)   ASC,
					LOWER(b.relation)  ASC,
					b.modified_at_utc  DESC
			) AS _rank
		`, phaseGuard, preferredPhase).
		Table("(?) AS b", orderedQuery)

	// Final query
	var rows []LatestSubmissionRow
	err := db.Model(&model.ReviewInfo{}).
		Select("root, project, group_1, relation, phase, submitted_at_utc").
		Table("(?) AS ranked", rankedQuery).
		Where("_rank = 1").
		Order("_order ASC").
		Limit(limit).
		Offset(offset).
		Scan(&rows).Error

	if err != nil {
		return nil, fmt.Errorf("ListLatestSubmissionsDynamic: %w", err)
	}

	return rows, nil
}

// ListAssetsPivot returns the fully pivoted rows + total count.
func (r *ReviewInfo) ListAssetsPivot(
	ctx context.Context,
	project, root, preferredPhase, orderKey, direction string,
	limit, offset int,
	assetNameKey string,
	approvalStatuses []string,
	workStatuses []string,
) ([]AssetPivot, int64, error) {
	if project == "" {
		return nil, 0, fmt.Errorf("project is required")
	}
	if root == "" {
		root = "assets"
	}

	// 1) Get total count for pagination
	total, err := r.CountLatestSubmissions(
		ctx,
		project,
		root,
		assetNameKey,
		preferredPhase,
		approvalStatuses,
		workStatuses,
	)
	if err != nil {
		return nil, 0, err
	}

	// 2) Get page "keys" (one primary row per asset, correctly ordered)
	keys, err := r.ListLatestSubmissionsDynamic(
		ctx,
		project,
		root,
		preferredPhase,
		orderKey,
		direction,
		limit,
		offset,
		assetNameKey,
		approvalStatuses,
		workStatuses,
	)
	if err != nil {
		return nil, 0, err
	}
	if len(keys) == 0 {
		return []AssetPivot{}, total, nil
	}

	// 3) Build WHERE conditions for the page's assets
	var orConditions []clause.Expression
	for _, k := range keys {
		orConditions = append(orConditions, clause.And(
			clause.Eq{Column: "ri.group_1", Value: k.Group1},
			clause.Eq{Column: "ri.relation", Value: k.Relation},
		))
	}

	db := r.db.WithContext(ctx)

	// 4) Create the latest phase CTE with grouping info
	latestPhaseQuery := db.Model(&model.ReviewInfo{}).Alias("ri").
		Select(`
			ri.project,
			ri.root,
			ri.group_1,
			ri.relation,
			ri.phase,
			ri.work_status,
			ri.approval_status,
			ri.submitted_at_utc,
			ri.modified_at_utc,
			JSON_UNQUOTE(JSON_EXTRACT(ri.groups, '$[0]')) AS leaf_group_name,
			gc.path AS group_category_path,
			SUBSTRING_INDEX(gc.path, '/', 1) AS top_group_node,
			ROW_NUMBER() OVER (
				PARTITION BY ri.project, ri.root, ri.group_1, ri.relation, ri.phase
				ORDER BY ri.modified_at_utc DESC
			) AS rn
		`).
		Joins("LEFT JOIN t_group_category_group AS gcg ON gcg.project = ri.project AND gcg.deleted = 0 AND gcg.path = JSON_UNQUOTE(JSON_EXTRACT(ri.groups, '$[0]'))").
		Joins("LEFT JOIN t_group_category AS gc ON gc.id = gcg.group_category_id AND gc.deleted = 0 AND gc.root = 'assets'").
		Where("ri.project = ?", project).
		Where("ri.root = ?", root).
		Where("ri.deleted = 0").
		Where(clause.Or(orConditions...))

	// 5) Execute the query
	var phases []struct {
		Project            string     `gorm:"column:project"`
		Root               string     `gorm:"column:root"`
		Group1             string     `gorm:"column:group_1"`
		Relation           string     `gorm:"column:relation"`
		Phase              string     `gorm:"column:phase"`
		WorkStatus         *string    `gorm:"column:work_status"`
		ApprovalStatus     *string    `gorm:"column:approval_status"`
		SubmittedAtUTC     *time.Time `gorm:"column:submitted_at_utc"`
		LeafGroupName      string     `gorm:"column:leaf_group_name"`
		GroupCategoryPath  string     `gorm:"column:group_category_path"`
		TopGroupNode       string     `gorm:"column:top_group_node"`
	}

	err = db.Table("(?) AS latest_phase", latestPhaseQuery).
		Select(`
			project,
			root,
			group_1,
			relation,
			phase,
			work_status,
			approval_status,
			submitted_at_utc,
			leaf_group_name,
			group_category_path,
			top_group_node
		`).
		Where("rn = 1").
		Scan(&phases).Error

	if err != nil {
		return nil, 0, fmt.Errorf("ListAssetsPivot.phaseFetch: %w", err)
	}

	// 6) Stitch phases into pivot rows
	type keyStruct struct {
		p, r, g, rel string
	}
	m := make(map[keyStruct]*AssetPivot, len(keys))
	orderedPtrs := make([]*AssetPivot, 0, len(keys))

	// create base pivot row per asset in the same order as `keys`
	for _, k := range keys {
		id := keyStruct{k.Project, k.Root, k.Group1, k.Relation}
		ap := &AssetPivot{
			Root:     k.Root,
			Project:  k.Project,
			Group1:   k.Group1,
			Relation: k.Relation,
		}
		m[id] = ap
		orderedPtrs = append(orderedPtrs, ap)
	}

	// fill per-phase fields + grouping info
	for _, pr := range phases {
		id := keyStruct{pr.Project, pr.Root, pr.Group1, pr.Relation}
		if ap, ok := m[id]; ok {
			// grouping info only needs to be set once
			if ap.LeafGroupName == "" {
				ap.LeafGroupName = pr.LeafGroupName
				ap.GroupCategoryPath = pr.GroupCategoryPath
				ap.TopGroupNode = pr.TopGroupNode
			}

			switch strings.ToLower(pr.Phase) {
			case "mdl":
				ap.MDLWorkStatus = pr.WorkStatus
				ap.MDLApprovalStatus = pr.ApprovalStatus
				ap.MDLSubmittedAtUTC = pr.SubmittedAtUTC
			case "rig":
				ap.RIGWorkStatus = pr.WorkStatus
				ap.RIGApprovalStatus = pr.ApprovalStatus
				ap.RIGSubmittedAtUTC = pr.SubmittedAtUTC
			case "bld":
				ap.BLDWorkStatus = pr.WorkStatus
				ap.BLDApprovalStatus = pr.ApprovalStatus
				ap.BLDSubmittedAtUTC = pr.SubmittedAtUTC
			case "dsn":
				ap.DSNWorkStatus = pr.WorkStatus
				ap.DSNApprovalStatus = pr.ApprovalStatus
				ap.DSNSubmittedAtUTC = pr.SubmittedAtUTC
			case "ldv":
				ap.LDVWorkStatus = pr.WorkStatus
				ap.LDVApprovalStatus = pr.ApprovalStatus
				ap.LDVSubmittedAtUTC = pr.SubmittedAtUTC
			}
		}
	}

	// 7) Convert []*AssetPivot → []AssetPivot in the same order as keys.
	ordered := make([]AssetPivot, len(orderedPtrs))
	for i, ap := range orderedPtrs {
		ordered[i] = *ap
	}

	return ordered, total, nil
}
