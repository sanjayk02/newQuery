// ──────────────────────────────────────────────────────────────────────────
// repository/reviewInfo.go
// ──────────────────────────────────────────────────────────────────────────

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

/* ========================= BASIC SETUP ========================= */

type ReviewInfo struct {
	db *gorm.DB
}

func NewReviewInfo(db *gorm.DB) (*ReviewInfo, error) {
	info := model.ReviewInfo{}
	m := db.Migrator()

	if m.HasTable(&info) && !m.HasColumn(&info, "take_path") {
		if err := m.RenameColumn(&info, "path", "take_path"); err != nil {
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
	return r.db.WithContext(ctx).Transaction(fc, opts...)
}

/* ========================= PIVOT TYPES ========================= */

type LatestSubmissionRow struct {
	Root           string
	Project        string
	Group1         string
	Relation       string
	Phase          string
	SubmittedAtUTC *time.Time
}

type AssetPivot struct {
	Root     string
	Project  string
	Group1   string
	Relation string

	LeafGroupName     string
	GroupCategoryPath string
	TopGroupNode      string

	MDLWorkStatus     *string
	MDLApprovalStatus *string
	MDLSubmittedAtUTC *time.Time

	RIGWorkStatus     *string
	RIGApprovalStatus *string
	RIGSubmittedAtUTC *time.Time

	BLDWorkStatus     *string
	BLDApprovalStatus *string
	BLDSubmittedAtUTC *time.Time

	DSNWorkStatus     *string
	DSNApprovalStatus *string
	DSNSubmittedAtUTC *time.Time

	LDVWorkStatus     *string
	LDVApprovalStatus *string
	LDVSubmittedAtUTC *time.Time
}

/* ========================= HELPERS ========================= */

func buildPhaseAwareStatusWhere(_ string, appr, work []string) (string, []any) {
	var clauses []string
	var args []any

	in := func(col string, vals []string) {
		if len(vals) == 0 {
			return
		}
		ph := strings.TrimRight(strings.Repeat("?,", len(vals)), ",")
		clauses = append(clauses, fmt.Sprintf("LOWER(%s) IN (%s)", col, ph))
		for _, v := range vals {
			args = append(args, strings.ToLower(strings.TrimSpace(v)))
		}
	}

	in("approval_status", appr)
	in("work_status", work)

	if len(clauses) == 0 {
		return "", nil
	}
	return strings.Join(clauses, " AND "), args
}

/* ========================= CORE QUERIES ========================= */

func (r *ReviewInfo) CountLatestSubmissions(
	ctx context.Context,
	project, root, name, preferredPhase string,
	appr, work []string,
) (int64, error) {

	db := r.db.WithContext(ctx)

	sub := db.Model(&model.ReviewInfo{}).
		Select(`
			project, root, group_1, relation, phase,
			ROW_NUMBER() OVER (
				PARTITION BY project, root, group_1, relation, phase
				ORDER BY modified_at_utc DESC
			) rn
		`).
		Where("project = ?", project).
		Where("root = ?", root).
		Where("deleted = 0")

	if name != "" {
		sub = sub.Where("LOWER(group_1) LIKE ?", strings.ToLower(name)+"%")
	}

	keys := db.Table("(?) AS t", sub).Where("rn = 1")

	if w, a := buildPhaseAwareStatusWhere(preferredPhase, appr, work); w != "" {
		keys = keys.Where(w, a...)
	}

	var total int64
	if err := db.Table("(?) AS x", keys).
		Select("project, root, group_1, relation").
		Group("project, root, group_1, relation").
		Count(&total).Error; err != nil {
		return 0, err
	}

	return total, nil
}

func (r *ReviewInfo) ListLatestSubmissionsDynamic(
	ctx context.Context,
	project, root, preferredPhase, orderKey, dir string,
	limit, offset int,
	name string,
	appr, work []string,
) ([]LatestSubmissionRow, error) {

	dir = strings.ToUpper(dir)
	if dir != "ASC" && dir != "DESC" {
		dir = "ASC"
	}

	db := r.db.WithContext(ctx)

	sub := db.Model(&model.ReviewInfo{}).
		Select(`
			project, root, group_1, relation, phase, submitted_at_utc, modified_at_utc,
			ROW_NUMBER() OVER (
				PARTITION BY project, root, group_1, relation, phase
				ORDER BY modified_at_utc DESC
			) rn
		`).
		Where("project = ?", project).
		Where("root = ?", root).
		Where("deleted = 0")

	if name != "" {
		sub = sub.Where("LOWER(group_1) LIKE ?", strings.ToLower(name)+"%")
	}

	keys := db.Table("(?) AS s", sub).Where("rn = 1")

	if w, a := buildPhaseAwareStatusWhere(preferredPhase, appr, work); w != "" {
		keys = keys.Where(w, a...)
	}

	query := db.Table("(?) AS k", keys).
		Select(`
			project, root, group_1, relation, phase, submitted_at_utc,
			ROW_NUMBER() OVER (
				PARTITION BY project, root, group_1, relation
				ORDER BY
					CASE WHEN phase = ? THEN 0 ELSE 1 END,
					modified_at_utc DESC
			) _rank
		`, preferredPhase)

	var rows []LatestSubmissionRow
	err := db.Table("(?) AS r", query).
		Where("_rank = 1").
		Order("_rank ASC"). // ✅ FIXED
		Limit(limit).
		Offset(offset).
		Scan(&rows).Error

	return rows, err
}

/* ========================= FINAL PIVOT ========================= */

func (r *ReviewInfo) ListAssetsPivot(
	ctx context.Context,
	project, root, preferredPhase, orderKey, direction string,
	limit, offset int,
	name string,
	appr, work []string,
) ([]AssetPivot, int64, error) {

	if root == "" {
		root = "assets"
	}

	total, err := r.CountLatestSubmissions(
		ctx, project, root, name, preferredPhase, appr, work,
	)
	if err != nil {
		return nil, 0, err
	}

	keys, err := r.ListLatestSubmissionsDynamic(
		ctx, project, root, preferredPhase,
		orderKey, direction, limit, offset,
		name, appr, work,
	)
	if err != nil {
		return nil, 0, err
	}
	if len(keys) == 0 {
		return []AssetPivot{}, total, nil
	}

	var ors []clause.Expression
	for _, k := range keys {
		ors = append(ors, clause.And(
			clause.Eq{Column: "ri.group_1", Value: k.Group1},
			clause.Eq{Column: "ri.relation", Value: k.Relation},
		))
	}
	if len(ors) == 0 {
		return []AssetPivot{}, total, nil
	}

	db := r.db.WithContext(ctx)

	query := db.Model(&model.ReviewInfo{}).Alias("ri").
		Select(`
			ri.project, ri.root, ri.group_1, ri.relation, ri.phase,
			ri.work_status, ri.approval_status, ri.submitted_at_utc,
			JSON_UNQUOTE(JSON_EXTRACT(ri.groups,'$[0]')) leaf_group_name,
			gc.path group_category_path,
			SUBSTRING_INDEX(gc.path,'/',1) top_group_node,
			ROW_NUMBER() OVER (
				PARTITION BY ri.project, ri.root, ri.group_1, ri.relation, ri.phase
				ORDER BY ri.modified_at_utc DESC
			) rn
		`).
		Joins("LEFT JOIN t_group_category_group gcg ON gcg.project = ri.project AND gcg.path = JSON_UNQUOTE(JSON_EXTRACT(ri.groups,'$[0]'))").
		Joins("LEFT JOIN t_group_category gc ON gc.id = gcg.group_category_id").
		Where("ri.project = ?", project).
		Where("ri.root = ?", root).
		Where("ri.deleted = 0").
		Where(clause.Or(ors...))

	var rows []struct {
		Project, Root, Group1, Relation, Phase string
		WorkStatus, ApprovalStatus             *string
		SubmittedAtUTC                         *time.Time
		LeafGroupName, GroupCategoryPath       string
		TopGroupNode                           string
	}

	if err := db.Table("(?) AS t", query).
		Where("rn = 1").
		Scan(&rows).Error; err != nil {
		return nil, 0, err
	}

	type key struct{ p, r, g, rel string }
	out := map[key]*AssetPivot{}
	ordered := make([]*AssetPivot, 0, len(keys))

	for _, k := range keys {
		ap := &AssetPivot{
			Root:     k.Root,
			Project:  k.Project,
			Group1:   k.Group1,
			Relation: k.Relation,
		}
		id := key{k.Project, k.Root, k.Group1, k.Relation}
		out[id] = ap
		ordered = append(ordered, ap)
	}

	for _, r := range rows {
		id := key{r.Project, r.Root, r.Group1, r.Relation}
		ap := out[id]
		if ap == nil {
			continue
		}
		if ap.LeafGroupName == "" {
			ap.LeafGroupName = r.LeafGroupName
			ap.GroupCategoryPath = r.GroupCategoryPath
			ap.TopGroupNode = r.TopGroupNode
		}
		switch strings.ToLower(r.Phase) {
		case "mdl":
			ap.MDLWorkStatus = r.WorkStatus
			ap.MDLApprovalStatus = r.ApprovalStatus
			ap.MDLSubmittedAtUTC = r.SubmittedAtUTC
		case "rig":
			ap.RIGWorkStatus = r.WorkStatus
			ap.RIGApprovalStatus = r.ApprovalStatus
			ap.RIGSubmittedAtUTC = r.SubmittedAtUTC
		case "bld":
			ap.BLDWorkStatus = r.WorkStatus
			ap.BLDApprovalStatus = r.ApprovalStatus
			ap.BLDSubmittedAtUTC = r.SubmittedAtUTC
		case "dsn":
			ap.DSNWorkStatus = r.WorkStatus
			ap.DSNApprovalStatus = r.ApprovalStatus
			ap.DSNSubmittedAtUTC = r.SubmittedAtUTC
		case "ldv":
			ap.LDVWorkStatus = r.WorkStatus
			ap.LDVApprovalStatus = r.ApprovalStatus
			ap.LDVSubmittedAtUTC = r.SubmittedAtUTC
		}
	}

	final := make([]AssetPivot, len(ordered))
	for i, p := range ordered {
		final[i] = *p
	}
	return final, total, nil
}
