// reviewInfo.go
package repo

import (
	"context"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

// ---------- Repo holder ----------
type ReviewInfo struct {
	db *gorm.DB
}

func NewReviewInfo(db *gorm.DB) *ReviewInfo { return &ReviewInfo{db: db} }

// ---------- Structs for Query Results ----------
type LatestSubmissionRow struct {
	Root           string     `json:"root"              gorm:"column:root"`
	Project        string     `json:"project"           gorm:"column:project"`
	Group1         string     `json:"group_1"           gorm:"column:group_1"`
	Relation       string     `json:"relation"          gorm:"column:relation"`
	Phase          string     `json:"phase"             gorm:"column:phase"`
	SubmittedAtUTC *time.Time `json:"submitted_at_utc"  gorm:"column:submitted_at_utc"`
}

type AssetPivot struct {
	Root     string `json:"root"`
	Project  string `json:"project"`
	Group1   string `json:"group_1"`
	Relation string `json:"relation"`

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

type phaseRow struct {
	Project        string     `gorm:"column:project"`
	Root           string     `gorm:"column:root"`
	Group1         string     `gorm:"column:group_1"`
	Relation       string     `gorm:"column:relation"`
	Phase          string     `gorm:"column:phase"`
	WorkStatus     *string    `gorm:"column:work_status"`
	ApprovalStatus *string    `gorm:"column:approval_status"`
	SubmittedAtUTC *time.Time `gorm:"column:submitted_at_utc"`
	ModifiedAtUTC  *time.Time `gorm:"column:modified_at_utc"`
}

// ---------- Count (for pagination total) ----------
func (r *ReviewInfo) CountLatestSubmissions(ctx context.Context, project, root string) (int64, error) {
	if project == "" {
		return 0, fmt.Errorf("project is required")
	}
	if root == "" {
		root = "assets"
	}

	const countSQL = `
SELECT COUNT(*) FROM (
  SELECT project, root, group_1, relation
  FROM t_review_info
  WHERE project = ? AND root = ? AND deleted = 0
  GROUP BY project, root, group_1, relation
) AS x;`

	var total int64
	if err := r.db.WithContext(ctx).Raw(countSQL, project, root).Scan(&total).Error; err != nil {
		return 0, fmt.Errorf("CountLatestSubmissions: %w", err)
	}
	return total, nil
}

// ---------- Work-status priority CASE (for ordering) ----------
func statusOrderExpr(alias string) string {
	col := func(c string) string {
		if alias == "" {
			return c
		}
		return alias + "." + c
	}
	ws := col("work_status")
	// Edit priorities as you like:
	return fmt.Sprintf(`
CASE
  WHEN LOWER(%s) = 'review'                         THEN 1
  WHEN LOWER(%s) = 'check'                          THEN 2
  WHEN LOWER(%s) = 'retake'                         THEN 3
  WHEN LOWER(%s) IN ('leadonhold','cgsvonhold')     THEN 4
  WHEN LOWER(%s) IN ('cgsvapproved','approved')     THEN 5
  ELSE 99
END`, ws, ws, ws, ws, ws)
}

// ---------- Dynamic Sorting Function ----------
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
	case "submitted_at_utc":
		return col("submitted_at_utc") + " " + dir

	case "modified_at_utc":
		return col("modified_at_utc") + " " + dir

	case "phase":
		return col("phase") + " " + dir

	case "group1_only":
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir, col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)

	case "relation_only":
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("relation"), dir, col("group_1"), col("submitted_at_utc"), col("submitted_at_utc"), dir)

	case "group_rel_submitted":
		return fmt.Sprintf("LOWER(%s) ASC, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)

	case "work_status":
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("work_status"), dir, col("group_1"), col("submitted_at_utc"), col("submitted_at_utc"), dir)

	case "work_status_priority":
		// Priority CASE, then readable tie-breakers
		return fmt.Sprintf("%s %s, LOWER(%s) ASC, LOWER(%s) ASC, %s DESC, %s DESC",
			statusOrderExpr(alias), dir,
			col("group_1"), col("relation"),
			col("modified_at_utc"), col("submitted_at_utc"))

	default:
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir, col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	}
}

// ---------- ListLatestSubmissionsDynamic (First query) ----------
func (r *ReviewInfo) ListLatestSubmissionsDynamic(
	ctx context.Context,
	project string,
	root string,
	preferredPhase string, // "mdl" | "rig" | "bld" | "dsn" | "ldv" | "none"
	orderKey string,       // group1_only | relation_only | group_rel_submitted | submitted_at_utc | modified_at_utc | phase | work_status | work_status_priority
	direction string,      // ASC | DESC
	limit, offset int,
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

	// phaseGuard=1 disables phase preference
	phaseGuard := 0
	if preferredPhase == "" || strings.EqualFold(preferredPhase, "none") {
		phaseGuard = 1
	}

	orderClauseWindow := buildOrderClause("", orderKey, direction)  // OUTER window
	orderClauseInner := buildOrderClause("b", orderKey, direction) // INNER order

	q := fmt.Sprintf(`
WITH ordered AS (
  SELECT
    *,
    ROW_NUMBER() OVER (ORDER BY %s) AS _order
  FROM (
    SELECT b.* FROM (
      SELECT project, root, group_1, relation, phase, MAX(modified_at_utc) AS modified_at_utc
      FROM t_review_info
      WHERE project = ? AND root = ? AND deleted = 0
      GROUP BY project, root, group_1, relation, phase
    ) AS a
    LEFT JOIN (
      SELECT root, project, group_1, phase, relation, work_status, submitted_at_utc, modified_at_utc, executed_computer
      FROM t_review_info
      WHERE project = ? AND root = ? AND deleted = 0
    ) AS b
      ON a.project = b.project
     AND a.root = b.root
     AND a.group_1 = b.group_1
     AND a.relation = b.relation
     AND a.phase = b.phase
     AND a.modified_at_utc = b.modified_at_utc
    ORDER BY %s
  ) AS k
),
offset_ordered AS (
  SELECT
    c.*,
    CASE
      WHEN ? = 1 THEN c._order                   -- no phase preference
      WHEN c.phase = ? THEN c._order             -- prefer requested phase
      ELSE 100000 + c._order
    END AS __order
  FROM ordered c
),
ranked AS (
  SELECT
    b.*,
    ROW_NUMBER() OVER (
      PARTITION BY b.root, b.project, b.group_1, b.relation
      ORDER BY
        CASE WHEN ? = 1 THEN 0 WHEN b.phase = ? THEN 0 ELSE 1 END,
        LOWER(b.group_1) ASC,
        LOWER(b.relation) ASC,
        b.modified_at_utc DESC
    ) AS _rank
  FROM offset_ordered b
)
SELECT root, project, group_1, relation, phase, submitted_at_utc
FROM ( SELECT * FROM ranked WHERE _rank = 1 ) AS t
ORDER BY __order ASC
LIMIT ? OFFSET ?;`, orderClauseWindow, orderClauseInner)

	args := []any{
		project, root, // inner latest-per-phase
		project, root, // inner join set
		phaseGuard, preferredPhase, // offset_ordered
		phaseGuard, preferredPhase, // ranked
		limit, offset,
	}

	var rows []LatestSubmissionRow
	if err := r.db.WithContext(ctx).Raw(q, args...).Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("ListLatestSubmissionsDynamic: %w", err)
	}
	return rows, nil
}

// ---------- ListAssetsPivot (Second query + pivot; MySQL-8 friendly) ----------
func (r *ReviewInfo) ListAssetsPivot(
	ctx context.Context,
	project, root, preferredPhase, orderKey, direction string,
	limit, offset int,
) ([]AssetPivot, int64, error) {

	total, err := r.CountLatestSubmissions(ctx, project, root)
	if err != nil {
		return nil, 0, err
	}

	// Use the same ordering & phase preference to get the page keys
	keys, err := r.ListLatestSubmissionsDynamic(ctx, project, root, preferredPhase, orderKey, direction, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	if len(keys) == 0 {
		return []AssetPivot{}, total, nil
	}

	// Build a CTE "keys" using SELECT … UNION ALL … (MySQL 8-compatible)
	var sb strings.Builder
	var params []any

	sb.WriteString("WITH keys AS (")
	for i, k := range keys {
		if i > 0 {
			sb.WriteString(" UNION ALL ")
		}
		sb.WriteString("SELECT ? AS root, ? AS project, ? AS group_1, ? AS relation")
		params = append(params, k.Root, k.Project, k.Group1, k.Relation)
	}
	sb.WriteString(`),
latest_per_phase AS (
  SELECT
    t.project, t.root, t.group_1, t.relation, t.phase,
    t.work_status, t.approval_status, t.submitted_at_utc, t.modified_at_utc,
    ROW_NUMBER() OVER (
      PARTITION BY t.project, t.root, t.group_1, t.relation, t.phase
      ORDER BY t.modified_at_utc DESC, t.submitted_at_utc DESC
    ) rn
  FROM t_review_info t
  JOIN keys k
    ON t.project  = k.project
   AND t.root     = k.root
   AND t.group_1  = k.group_1
   AND t.relation = k.relation
  WHERE t.deleted = 0
)
SELECT project, root, group_1, relation, phase, work_status, approval_status, submitted_at_utc
FROM latest_per_phase
WHERE rn = 1;`)

	var rows []phaseRow
	if err := r.db.WithContext(ctx).Raw(sb.String(), params...).Scan(&rows).Error; err != nil {
		return nil, 0, fmt.Errorf("ListAssetsPivot.fetch: %w", err)
	}

	// Pivot in Go preserving the order of "keys"
	type kkey struct{ P, R, G, L string }
	mp := make(map[kkey]*AssetPivot, len(keys))
	ordered := make([]AssetPivot, 0, len(keys))

	for _, k := range keys {
		id := kkey{k.Project, k.Root, k.Group1, k.Relation}
		ap := &AssetPivot{
			Root:     k.Root,
			Project:  k.Project,
			Group1:   k.Group1,
			Relation: k.Relation,
		}
		mp[id] = ap
		ordered = append(ordered, *ap)
	}
	for _, pr := range rows {
		id := kkey{pr.Project, pr.Root, pr.Group1, pr.Relation}
		ap, ok := mp[id]
		if !ok {
			continue
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

	for i := range ordered {
		id := kkey{ordered[i].Project, ordered[i].Root, ordered[i].Group1, ordered[i].Relation}
		if filled, ok := mp[id]; ok {
			ordered[i] = *filled
		}
	}
	return ordered, total, nil
}
