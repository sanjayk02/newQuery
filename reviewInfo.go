package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/PolygonPictures/central30-web/front/entity"
	"github.com/PolygonPictures/central30-web/front/repository/model"
	"gorm.io/gorm"
)

// ---------------- Sort Whitelist ----------------

// allowSort validates the sort token and provides the corresponding SQL ORDER BY fragment.
func allowSort(token string) (string, bool) {
	if token == "" {
		return "", false
	}
	// Maps sort token (e.g., "-group_1") to safe SQL fragment (e.g., "group_1 DESC")
	m := map[string]string{
		"group_1":    "group_1 ASC",
		"-group_1":   "group_1 DESC",
		"relation":   "relation ASC",
		"-relation":  "relation DESC",
		"phase":      "phase ASC",
		"-phase":     "phase DESC",
		"modified":   "modified_at_utc DESC",
		"-modified":  "modified_at_utc ASC",
		"submitted":  "submitted_at_utc DESC",
		"-submitted": "submitted_at_utc ASC",
		"__order":    "__order ASC",
		"-__order":   "__order DESC",
	}
	v, ok := m[token]
	return v, ok
}

// ---------------- CTEs (assets latest-per-phase → pick one row per asset) ----------------

// NOTE: Commas are now added during final concatenation in baseSQL.
const orderedCTE = `
WITH ordered AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY group_1 ASC, relation ASC) AS _order
    FROM (
        SELECT b.*
        FROM (
            SELECT project, root, group_1, relation, phase, MAX(modified_at_utc) AS modified_at_utc
            FROM t_review_info
            WHERE project = @Project AND root = 'assets' AND deleted = 0
            GROUP BY project, root, group_1, relation, phase
        ) AS a
        LEFT JOIN (
            SELECT *
            FROM t_review_info
            WHERE project = @Project AND root = 'assets' AND deleted = 0
        ) AS b
        ON a.project = b.project
       AND a.root = b.root
       AND a.group_1 = b.group_1
       AND a.relation = b.relation
       AND a.phase = b.phase
       AND a.modified_at_utc = b.modified_at_utc
    ) AS k
)`
const offsetOrderedCTE = `
offset_ordered AS (
    SELECT c.*,
           CASE WHEN c.phase = 'mdl' THEN c._order ELSE 100000 + c._order END AS __order
    FROM ordered c
)`
const rankedCTE = `
ranked AS (
    SELECT b.*,
           ROW_NUMBER() OVER (
             PARTITION BY b.root, b.project, b.group_1, b.relation
             ORDER BY CASE WHEN b.phase='mdl' THEN 0 ELSE 1 END
           ) AS _rank
    FROM offset_ordered b
)`
const finalSelect = `
SELECT * FROM (SELECT * FROM ranked WHERE _rank=1) AS t
`
// Concatenate CTEs with commas for a valid raw SQL query string
const baseSQL = orderedCTE + "," + offsetOrderedCTE + "," + rankedCTE + finalSelect

// ---------------- Repo ----------------

type ReviewInfo struct{ db *gorm.DB }

func NewReviewInfo(db *gorm.DB) (*ReviewInfo, error) { 
    info := model.ReviewInfo{}
    
    // Specification change: https://jira.ppi.co.jp/browse/POTOO-2406
    migrator := db.Migrator()
    if migrator.HasTable(&info) && !migrator.HasColumn(&info, "take_path") {
        if err := migrator.RenameColumn(&info, "path", "take_path"); err != nil {
            return nil, err
        }
    }

    if err := db.AutoMigrate(&info); err != nil {
        return nil, err
    }

    return &ReviewInfo{db: db}, nil
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
	stmt := db.Model(&model.ReviewInfo{},
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

	// Map reviews to entity.ReviewInfo
	reviewInfos := make([]*entity.ReviewInfo, len(reviews))
	for i, review := range reviews {
		reviewInfos[i] = review.Entity(false)
	}
	return reviewInfos, nil
}


// Latest per (project, root, group_1, relation, phase) by submitted_at_utc, with safe sort + paging
func (r *ReviewInfo) ListLatestSubmissionsWithSort(
	ctx context.Context, db *gorm.DB, project string, limit, offset int, sort string,
) ([]*entity.ReviewInfo, error) {

	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	// (a) latest submitted_at_utc per group
	stmtA := db.WithContext(ctx).Select(
		"project", "root", "group_1", "relation", "phase",
		"MAX(submitted_at_utc) AS submitted_at_utc",
	).Model(&model.ReviewInfo{}).
		Where("project = ?", project).
		Where("deleted = ?", 0).
		Group("project, root, group_1, relation, phase")

	// (b) full rows
	stmtB := db.WithContext(ctx).Select("*").
		Model(&model.ReviewInfo{}).
		Where("project = ?", project).
		Where("deleted = ?", 0)

	// join (a) to (b)
	stmt := db.WithContext(ctx).
		Select("b.*").
		Table("(?) AS a", stmtA).
		Joins(`
			INNER JOIN (?) AS b
			ON a.project=b.project AND a.root=b.root AND a.group_1=b.group_1
			AND a.relation=b.relation AND a.phase=b.phase
			AND a.submitted_at_utc=b.submitted_at_utc
		`, stmtB)

	order := "submitted_at_utc DESC, id DESC"
	if safe, ok := allowSort(sort); ok {
		order = safe + ", id DESC"
	}

	var rows []*model.ReviewInfo
	if err := stmt.Order(order).Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		return nil, err
	}

	out := make([]*entity.ReviewInfo, 0, len(rows))
	for _, m := range rows {
		out = append(out, m.Entity(false))
	}
	return out, nil
}

// One row per asset (prioritize mdl for overall sort); returns (rows, totalAssets)
func (r *ReviewInfo) ListLatestAssetReviewInfoForAssets(
	db *gorm.DB, params *entity.AssetListParams,
) ([]*entity.ReviewInfo, int, error) {

	// total distinct assets
	var total int64
	if err := db.Model(&model.ReviewInfo{}).
		Where("deleted = ?", 0).
		Where("project = ?", params.Project).
		Where("root = ?", "assets").
		Select("COUNT(DISTINCT CONCAT_WS('|', project, root, group_1, relation))").
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// paging
	limit := params.GetPerPage()
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	page := params.GetPage()
	if page <= 0 {
		page = 1
	}
	offset := limit * (page - 1)

	// order
	orderBy := "ORDER BY __order ASC, id DESC"
	if params.OrderBy != nil && *params.OrderBy != "" {
		if safe, ok := allowSort(*params.OrderBy); ok {
			orderBy = "ORDER BY " + safe + ", id DESC"
		}
	}

	// final SQL
	rawSQL := fmt.Sprintf("%s %s LIMIT @Limit OFFSET @Offset", baseSQL, orderBy)

	var models []*model.ReviewInfo
	err := db.Raw(
		rawSQL,
		sql.Named("Project", params.Project),
		sql.Named("Limit", limit),
		sql.Named("Offset", offset),
	).Scan(&models).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, 0, err
	}

	entities := make([]*entity.ReviewInfo, 0, len(models))
	for _, m := range models {
		entities = append(entities, m.Entity(false))
	}
	return entities, int(total), nil
}