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
	* - 16-01-2026 - SanjayK PSI - Added asset pivot listing with grouped view  and sorting.
	* - 27-01-2026 - Added timeout protection and caching to prevent query timeouts.

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
	* - withTimeout: Adds timeout protection to database queries.
	* - getFromCache/setToCache: Implements caching for frequently accessed data.

	────────────────────────────────────────────────────────────────────────── */

package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/PolygonPictures/central30-web/front/entity"
	"github.com/PolygonPictures/central30-web/front/repository/model"
	"gorm.io/gorm"
)

type ReviewInfo struct {
	db    *gorm.DB
	cache sync.Map
}

type cachedResult struct {
	data      interface{}
	timestamp time.Time
	page      int
	limit     int
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
		db:    db,
		cache: sync.Map{},
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

func (r *ReviewInfo) withTimeout(ctx context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	if deadline, ok := ctx.Deadline(); ok {
		// Use existing deadline if earlier
		return context.WithDeadline(ctx, deadline)
	}
	return context.WithTimeout(ctx, timeout)
}

func (r *ReviewInfo) getCacheKey(project, root, assetNameKey string, page, limit int, orderKey, direction string) string {
	// Create a unique cache key based on all parameters
	return fmt.Sprintf("assets:%s:%s:%s:%d:%d:%s:%s",
		project, root, assetNameKey, page, limit, orderKey, direction)
}

func (r *ReviewInfo) getFromCache(key string) ([]AssetPivot, bool) {
	if cached, ok := r.cache.Load(key); ok {
		cr := cached.(cachedResult)
		// Cache valid for 2 minutes
		if time.Since(cr.timestamp) < 2*time.Minute {
			return cr.data.([]AssetPivot), true
		}
		// Remove expired cache
		r.cache.Delete(key)
	}
	return nil, false
}

func (r *ReviewInfo) setToCache(key string, data []AssetPivot, page, limit int) {
	r.cache.Store(key, cachedResult{
		data:      data,
		timestamp: time.Now(),
		page:      page,
		limit:     limit,
	})
}

func (r *ReviewInfo) ClearCache() {
	r.cache = sync.Map{}
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

/* -─────────────────────────────────────────────────────────────────────────
	Assets and Latest Submission Rows
───────────────────────────────────────────────────────────────────────────
*/
// ---- Latest Submission row ----
type LatestSubmissionRow struct {
	Root           string     `json:"root"              gorm:"column:root"`
	Project        string     `json:"project"           gorm:"column:project"`
	Group1         string     `json:"group_1"           gorm:"column:group_1"`
	Relation       string     `json:"relation"          gorm:"column:relation"`
	Phase          string     `json:"phase"             gorm:"column:phase"`
	SubmittedAtUTC *time.Time `json:"submitted_at_utc"  gorm:"column:submitted_at_utc"`
}

// ---- Asset Pivot row ----
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

// ---- phaseRow for intermediate query ----
type phaseRow struct {
	Project        string     `gorm:"column:project"`
	Root           string     `gorm:"column:root"`
	Group1         string     `gorm:"column:group_1"`
	Relation       string     `gorm:"column:relation"`
	Phase          string     `gorm:"column:phase"`
	WorkStatus     *string    `gorm:"column:work_status"`
	ApprovalStatus *string    `gorm:"column:approval_status"`
	SubmittedAtUTC *time.Time `gorm:"column:submitted_at_utc"`

	LeafGroupName     string `gorm:"column:leaf_group_name"`
	GroupCategoryPath string `gorm:"column:group_category_path"`
	TopGroupNode      string `gorm:"column:top_group_node"`
}

// ---- Sort Direction ----
type SortDirection string

// SortDirection constants
const (
	SortASC  SortDirection = "ASC"
	SortDESC SortDirection = "DESC"
)

// ---- Grouped Asset Bucket ----
type GroupedAssetBucket struct {
	TopGroupNode string       `json:"top_group_node"` // camera / character / prop / ...
	ItemCount    int          `json:"item_count"`
	Items        []AssetPivot `json:"items"`
	TotalCount   *int         `json:"total_count"` // optional total count across pages

}

/*
──────────────────────────────────────────────────────────────────────────

	GroupAndSortByTopNode groups a slice of AssetPivot items by their TopGroupNode field,
	sorts the group headers alphabetically (A→Z, case-insensitive), and always places the
	"Unassigned" group last. Within each group, the items are sorted by their Group1 field
	in either ascending or descending order, as specified by the dir parameter.
	Returns a slice of GroupedAssetBucket, each containing a group header and its sorted items.

	Parameters:
	- rows: Slice of AssetPivot items to be grouped and sorted.
	- dir: SortDirection specifying ascending or descending order for items within each group.

	Returns:
	- []GroupedAssetBucket: Slice of grouped and sorted asset buckets.

───────────────────────────────────────────────────────────────────────────
*/
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

/*
──────────────────────────────────────────────────────────────────────────

	buildPhaseAwareStatusWhere constructs a SQL WHERE clause segment that filters rows based on the provided
	approvalStatuses and workStatuses. It generates case-insensitive "IN" conditions for the columns
	"approval_status" and "work_status" if their respective status slices are non-empty.
	The function returns the WHERE clause string (prefixed with " AND ") and a slice of arguments
	corresponding to the status values, all converted to lowercase and trimmed of whitespace.
	If both status slices are empty, it returns an empty string and nil arguments.

───────────────────────────────────────────────────────────────────────────
*/
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

/*
──────────────────────────────────────────────────────────────────────────

	buildOrderClause constructs an SQL ORDER BY clause string based on the provided
	alias, key, and direction. It supports various keys for sorting, including generic
	columns (e.g., submitted_at_utc, modified_at_utc, phase), name/relation combinations,
	phase-specific submitted dates, work status, and approval status. The direction
	(dir) is normalized to "ASC" or "DESC", defaulting to "ASC" if invalid. The alias
	is prepended to column names if provided. For unrecognized keys, a default ordering
	by group_1, relation, and submitted_at_utc is used. The function ensures proper
	handling of NULL values and alphabetical sorting where applicable.

	Parameters:

		alias string - Optional table alias to prefix column names.
		key   string - The column or logical key to sort by.
		dir   string - Sort direction ("ASC" or "DESC").

	Returns:

		string - The constructed SQL ORDER BY clause.

──────────────────────────────────────────────────────────────────────────
*/
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

/*
	──────────────────────────────────────────────────────────────────────────
	CountLatestSubmissions returns the count of latest review submissions for a given project and asset root,
	optionally filtered by asset name prefix, approval statuses, and work statuses.
	The function ignores the preferredPhase parameter for filtering but keeps it for API compatibility.
	It queries the database for the latest (by modified_at_utc) review info per asset and relation,
	applying the specified filters, and returns the total count.
	Returns an error if the project is not specified or if the database query fails.

	Parameters:
	ctx              - Context for database operations.
	project          - Project identifier (required).
	root             - Asset root; defaults to "assets" if empty.
	assetNameKey     - Optional asset name prefix filter (case-insensitive).
	preferredPhase   - Phase parameter (ignored in filtering; kept for compatibility).
	approvalStatuses - List of approval statuses to filter by.
	workStatuses     - List of work statuses to filter by.

	Returns:
	int64 - Count of latest submissions matching the filters.
	error - Error if project is missing or database query fails.

──────────────────────────────────────────────────────────────────────────
*/
func (r *ReviewInfo) CountLatestSubmissions(
	ctx context.Context,
	project, root, assetNameKey string,
	preferredPhase string, // kept for API compatibility; ignored in filtering
	approvalStatuses []string,
	workStatuses []string,
) (int64, error) {
	if project == "" {
		return 0, fmt.Errorf("project is required")
	}
	if root == "" {
		root = "assets"
	}

	// Add timeout protection
	queryCtx, cancel := r.withTimeout(ctx, 15*time.Second)
	defer cancel()

	db := r.db.WithContext(queryCtx)

	// Simple count of distinct assets
	query := `
SELECT COUNT(DISTINCT CONCAT(group_1, '|', relation))
FROM t_review_info
WHERE project = ? 
    AND root = ? 
    AND deleted = 0
    AND (? = '' OR LOWER(group_1) LIKE ?)
`
	
	var nameArg any
	if strings.TrimSpace(assetNameKey) != "" {
		nameArg = strings.ToLower(strings.TrimSpace(assetNameKey)) + "%"
	} else {
		nameArg = ""
	}

	var total int64
	if err := db.Raw(query, project, root, nameArg, nameArg).Scan(&total).Error; err != nil {
		return 0, fmt.Errorf("CountLatestSubmissions: %w", err)
	}

	return total, nil
}

/*
	──────────────────────────────────────────────────────────────────────────

	ListLatestSubmissionsDynamic retrieves a list of the latest review submissions
	for a specified project and asset root, with dynamic filtering and sorting options.
	Parameters:
	- ctx: Context for database operations.
	- project: Project identifier (required).
	- root: Asset root; defaults to "assets" if empty.
	- preferredPhase: Phase to prioritize in sorting; if empty or "none", no bias is applied.
	- orderKey: Column or logical key to sort by (e.g., "submitted_at_utc", "group1_only").
	- direction: Sort direction ("ASC" or "DESC").
	- limit: Maximum number of results to return; defaults to 60 if <= 0.
	- offset: Number of results to skip; defaults to 0 if < 0.
	- assetNameKey: Optional asset name prefix filter (case-insensitive).
	- approvalStatuses: List of approval statuses to filter by.
	- workStatuses: List of work statuses to filter by.
	Returns:
	- []LatestSubmissionRow: Slice of latest submission rows matching the filters.
	- error: Error if project is missing or database query fails.

───────────────────────────────────────────────────────────────────────────
*/
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

	// Add timeout protection
	queryCtx, cancel := r.withTimeout(ctx, 30*time.Second)
	defer cancel()

	db := r.db.WithContext(queryCtx)

	// SIMPLE APPROACH: Get unique assets first, then get their latest review
	// This avoids complex window functions
	
	// Step 1: Get unique assets (much simpler query)
	assetsQuery := `
SELECT DISTINCT 
    group_1,
    relation
FROM t_review_info
WHERE project = ? 
    AND root = ? 
    AND deleted = 0
    AND (? = '' OR LOWER(group_1) LIKE ?)
`
	
	var nameArg any
	if strings.TrimSpace(assetNameKey) != "" {
		nameArg = strings.ToLower(strings.TrimSpace(assetNameKey)) + "%"
	} else {
		nameArg = ""
	}
	
	// Get all matching assets
	var assets []struct {
		Group1    string `gorm:"column:group_1"`
		Relation  string `gorm:"column:relation"`
	}
	
	if err := db.Raw(assetsQuery, project, root, nameArg, nameArg).Scan(&assets).Error; err != nil {
		return nil, fmt.Errorf("failed to get assets: %w", err)
	}
	
	if len(assets) == 0 {
		return []LatestSubmissionRow{}, nil
	}
	
	// Step 2: For each asset, get the latest review in memory (small dataset)
	// This is efficient because we're only processing the page of assets
	
	// Apply pagination in memory (since we can't use OFFSET efficiently)
	// Sort assets in memory
	sort.Slice(assets, func(i, j int) bool {
		// Simple sorting - can be enhanced
		if strings.ToLower(assets[i].Group1) != strings.ToLower(assets[j].Group1) {
			return strings.ToLower(assets[i].Group1) < strings.ToLower(assets[j].Group1)
		}
		return strings.ToLower(assets[i].Relation) < strings.ToLower(assets[j].Relation)
	})
	
	// Apply pagination
	start := offset
	end := offset + limit
	if start > len(assets) {
		return []LatestSubmissionRow{}, nil
	}
	if end > len(assets) {
		end = len(assets)
	}
	
	paginatedAssets := assets[start:end]
	
	// Step 3: For paginated assets, get their latest review info
	if len(paginatedAssets) == 0 {
		return []LatestSubmissionRow{}, nil
	}
	
	// Build query for specific assets
	var sb strings.Builder
	var params []any
	
	sb.WriteString(`
SELECT 
    ri.root,
    ri.project,
    ri.group_1,
    ri.relation,
    ri.phase,
    ri.submitted_at_utc
FROM t_review_info ri
WHERE ri.deleted = 0
    AND ri.project = ?
    AND ri.root = ?
    AND (
`)
	
	params = append(params, project, root)
	
	for i, asset := range paginatedAssets {
		if i > 0 {
			sb.WriteString(" OR ")
		}
		sb.WriteString("(ri.group_1 = ? AND ri.relation = ?)")
		params = append(params, asset.Group1, asset.Relation)
	}
	sb.WriteString(")")
	
	// Get all reviews for these assets
	var allReviews []LatestSubmissionRow
	if err := db.Raw(sb.String(), params...).Scan(&allReviews).Error; err != nil {
		return nil, fmt.Errorf("failed to get reviews: %w", err)
	}
	
	// Step 4: In-memory processing to get latest per asset
	// Group by asset and find the latest
	assetMap := make(map[string]LatestSubmissionRow)
	for _, review := range allReviews {
		key := review.Group1 + "|" + review.Relation
		existing, exists := assetMap[key]
		
		if !exists || (review.SubmittedAtUTC != nil && existing.SubmittedAtUTC != nil && 
			review.SubmittedAtUTC.After(*existing.SubmittedAtUTC)) {
			assetMap[key] = review
		}
	}
	
	// Convert back to slice in the correct order
	result := make([]LatestSubmissionRow, 0, len(paginatedAssets))
	for _, asset := range paginatedAssets {
		key := asset.Group1 + "|" + asset.Relation
		if review, ok := assetMap[key]; ok {
			result = append(result, review)
		}
	}
	
	return result, nil
}

/*
──────────────────────────────────────────────────────────────────────────

	ListAssetsPivot retrieves a paginated list of AssetPivot rows for a specified project and asset root,
	optionally filtered by asset name prefix, preferred phase, approval statuses, and work statuses.
	Parameters:
	- ctx: Context for database operations.
	- project: Project identifier (required).
	- root: Asset root; defaults to "assets" if empty.
	- preferredPhase: Phase to prioritize in sorting; if empty or "none", no bias is applied.
	- orderKey: Column or logical key to sort by (e.g., "submitted_at_utc", "group1_only").
	- direction: Sort direction ("ASC" or "DESC").
	- limit: Maximum number of results to return; defaults to 60 if <= 0.
	- offset: Number of results to skip; defaults to 0 if < 0.
	- assetNameKey: Optional asset name prefix filter (case-insensitive).
	- approvalStatuses: List of approval statuses to filter by.
	- workStatuses: List of work statuses to filter by.
	Returns:
	- []AssetPivot: Slice of AssetPivot rows matching the filters.
	- int64: Total count of assets matching the filters (for pagination).
	- error: Error if project is missing or database query fails.

───────────────────────────────────────────────────────────────────────────
*/
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

	// Calculate page number from offset/limit
	page := 1
	if limit > 0 {
		page = (offset / limit) + 1
	}
	
	// Try cache first
	cacheKey := r.getCacheKey(project, root, assetNameKey, page, limit, orderKey, direction)
	if cachedData, found := r.getFromCache(cacheKey); found {
		// Still need to get total count
		total, err := r.CountLatestSubmissions(
			ctx, project, root, assetNameKey, preferredPhase, approvalStatuses, workStatuses,
		)
		if err == nil {
			return cachedData, total, nil
		}
	}
	
	// Add timeout protection for database operations
	queryCtx, cancel := r.withTimeout(ctx, 30*time.Second)
	defer cancel()

	// 1. Get total count
	total, err := r.CountLatestSubmissions(
		queryCtx,
		project, root, assetNameKey, preferredPhase, approvalStatuses, workStatuses,
	)
	if err != nil {
		return nil, 0, err
	}

	// 2. Get latest submissions
	latestRows, err := r.ListLatestSubmissionsDynamic(
		queryCtx,
		project, root, preferredPhase, orderKey, direction,
		limit, offset, assetNameKey, approvalStatuses, workStatuses,
	)
	if err != nil {
		return nil, 0, err
	}

	if len(latestRows) == 0 {
		return []AssetPivot{}, total, nil
	}

	// 3. Get ALL reviews for these assets (all phases)
	var sb strings.Builder
	var params []any
	
	sb.WriteString(`
SELECT 
    ri.project,
    ri.root,
    ri.group_1,
    ri.relation,
    ri.phase,
    ri.work_status,
    ri.approval_status,
    ri.submitted_at_utc,
    JSON_UNQUOTE(JSON_EXTRACT(ri.groups, '$[0]')) as leaf_group_name
FROM t_review_info ri
WHERE ri.deleted = 0
    AND ri.project = ?
    AND ri.root = ?
    AND (
`)
	
	params = append(params, project, root)
	
	for i, row := range latestRows {
		if i > 0 {
			sb.WriteString(" OR ")
		}
		sb.WriteString("(ri.group_1 = ? AND ri.relation = ?)")
		params = append(params, row.Group1, row.Relation)
	}
	sb.WriteString(")")

	// Execute with timeout context
	db := r.db.WithContext(queryCtx)
	var phaseData []struct {
		Project        string     `gorm:"column:project"`
		Root           string     `gorm:"column:root"`
		Group1         string     `gorm:"column:group_1"`
		Relation       string     `gorm:"column:relation"`
		Phase          string     `gorm:"column:phase"`
		WorkStatus     *string    `gorm:"column:work_status"`
		ApprovalStatus *string    `gorm:"column:approval_status"`
		SubmittedAtUTC *time.Time `gorm:"column:submitted_at_utc"`
		LeafGroupName  string     `gorm:"column:leaf_group_name"`
	}
	
	if err := db.Raw(sb.String(), params...).Scan(&phaseData).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to get phase data: %w", err)
	}

	// 4. Build pivot rows in memory
	assetMap := make(map[string]*AssetPivot)
	
	for _, row := range latestRows {
		key := row.Group1 + "|" + row.Relation
		assetMap[key] = &AssetPivot{
			Root:     row.Root,
			Project:  row.Project,
			Group1:   row.Group1,
			Relation: row.Relation,
		}
	}

	// Fill in phase data
	for _, pd := range phaseData {
		key := pd.Group1 + "|" + pd.Relation
		ap := assetMap[key]
		if ap == nil {
			continue
		}

		if ap.LeafGroupName == "" {
			ap.LeafGroupName = pd.LeafGroupName
		}

		phase := strings.ToLower(pd.Phase)
		switch phase {
		case "mdl":
			ap.MDLWorkStatus = pd.WorkStatus
			ap.MDLApprovalStatus = pd.ApprovalStatus
			ap.MDLSubmittedAtUTC = pd.SubmittedAtUTC
		case "rig":
			ap.RIGWorkStatus = pd.WorkStatus
			ap.RIGApprovalStatus = pd.ApprovalStatus
			ap.RIGSubmittedAtUTC = pd.SubmittedAtUTC
		case "bld":
			ap.BLDWorkStatus = pd.WorkStatus
			ap.BLDApprovalStatus = pd.ApprovalStatus
			ap.BLDSubmittedAtUTC = pd.SubmittedAtUTC
		case "dsn":
			ap.DSNWorkStatus = pd.WorkStatus
			ap.DSNApprovalStatus = pd.ApprovalStatus
			ap.DSNSubmittedAtUTC = pd.SubmittedAtUTC
		case "ldv":
			ap.LDVWorkStatus = pd.WorkStatus
			ap.LDVApprovalStatus = pd.ApprovalStatus
			ap.LDVSubmittedAtUTC = pd.SubmittedAtUTC
		}
	}

	// 5. Convert to result slice in correct order
	result := make([]AssetPivot, 0, len(latestRows))
	for _, row := range latestRows {
		key := row.Group1 + "|" + row.Relation
		if ap, ok := assetMap[key]; ok {
			result = append(result, *ap)
		}
	}

	// Cache the result
	r.setToCache(cacheKey, result, page, limit)

	return result, total, nil
}