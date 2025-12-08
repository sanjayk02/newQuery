package repository

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"
)

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

// ---- phase row for internal pivot fetch ----
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
	Items        []AssetPivot `json:"items"`
}

// Groups by TopGroupNode, keeps group order stable, sorts children by Group1
func GroupAndSortByTopNode(rows []AssetPivot, dir SortDirection) []GroupedAssetBucket {
	grouped := make(map[string][]AssetPivot)
	order := make([]string, 0)

	// group and remember first-seen order of TopGroupNode
	for _, row := range rows {
		key := row.TopGroupNode
		if key == "" {
			key = "Unassigned"
		}
		if _, exists := grouped[key]; !exists {
			grouped[key] = []AssetPivot{}
			order = append(order, key)
		}
		grouped[key] = append(grouped[key], row)
	}

	// sort children inside each group by Group1
	for _, key := range order {
		children := grouped[key]
		sort.Slice(children, func(i, j int) bool {
			if dir == SortDESC {
				return children[i].Group1 > children[j].Group1
			}
			return children[i].Group1 < children[j].Group1
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
// ========================= RAW QUERIES (GORM) ==========================
// ========================================================================

// CountLatestSubmissions returns total asset count (for pagination) after filters.
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

	db := r.db.WithContext(ctx)

	// name prefix filter
	nameCond := ""
	var nameArg any
	if strings.TrimSpace(assetNameKey) != "" {
		nameCond = " AND LOWER(group_1) LIKE ?"
		nameArg = strings.ToLower(strings.TrimSpace(assetNameKey)) + "%"
	}

	// status filter (no phase restriction)
	statusWhere, statusArgs := buildPhaseAwareStatusWhere(preferredPhase, approvalStatuses, workStatuses)

	sql := `
WITH latest_phase AS (
  SELECT
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
  FROM t_review_info
  WHERE project = ? AND root = ? AND deleted = 0` + nameCond + `
)
SELECT COUNT(*) FROM (
  SELECT project, root, group_1, relation
  FROM latest_phase
  WHERE rn = 1` + statusWhere + `
  GROUP BY project, root, group_1, relation
) AS x;
`

	args := []any{project, root}
	if nameArg != nil {
		args = append(args, nameArg)
	}
	args = append(args, statusArgs...)

	var total int64
	if err := db.Raw(sql, args...).Scan(&total).Error; err != nil {
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

	// name prefix filter
	nameCond := ""
	var nameArg any
	if strings.TrimSpace(assetNameKey) != "" {
		nameCond = " AND LOWER(group_1) LIKE ?"
		nameArg = strings.ToLower(strings.TrimSpace(assetNameKey)) + "%"
	}

	// status filter
	statusWhere, statusArgs := buildPhaseAwareStatusWhere(preferredPhase, approvalStatuses, workStatuses)

	// keys subquery: which assets (root+project+group_1+relation) are in scope
	keysSQL := `
WITH latest_phase AS (
  SELECT
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
  FROM t_review_info
  WHERE project = ? AND root = ? AND deleted = 0` + nameCond + `
)
SELECT project, root, group_1, relation
FROM latest_phase
WHERE rn = 1` + statusWhere + `
GROUP BY project, root, group_1, relation
`

	q := fmt.Sprintf(`
WITH ordered AS (
  SELECT
    *,
    ROW_NUMBER() OVER (ORDER BY %s) AS _order
  FROM (
    SELECT b.*
    FROM (
      SELECT
        project,
        root,
        group_1,
        relation,
        phase,
        MAX(modified_at_utc) AS modified_at_utc
      FROM t_review_info
      WHERE project = ? AND root = ? AND deleted = 0
      GROUP BY project, root, group_1, relation, phase
    ) AS a
    LEFT JOIN (
      SELECT
        root,
        project,
        group_1,
        phase,
        relation,
        work_status,
        approval_status,
        submitted_at_utc,
        modified_at_utc
      FROM t_review_info
      WHERE project = ? AND root = ? AND deleted = 0
    ) AS b
      ON a.project = b.project
     AND a.root    = b.root
     AND a.group_1 = b.group_1
     AND a.relation = b.relation
     AND a.phase    = b.phase
     AND a.modified_at_utc = b.modified_at_utc

    INNER JOIN ( %s ) AS fk
      ON b.project = fk.project
     AND b.root    = fk.root
     AND b.group_1 = fk.group_1
     AND b.relation = fk.relation

    ORDER BY %s
  ) AS k
),
offset_ordered AS (
  SELECT
    c.*,
    CASE
      WHEN ? = 1 THEN c._order
      WHEN c.phase = ? THEN c._order
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
        CASE
          WHEN ? = 1 THEN 0
          WHEN b.phase = ? THEN 0
          ELSE 1
        END,
        LOWER(b.group_1)   ASC,
        LOWER(b.relation)  ASC,
        b.modified_at_utc  DESC
    ) AS _rank
  FROM offset_ordered b
)
SELECT
  root,
  project,
  group_1,
  relation,
  phase,
  submitted_at_utc
FROM ranked
WHERE _rank = 1
ORDER BY __order ASC
LIMIT ? OFFSET ?;
`, orderClauseWindow, keysSQL, orderClauseInner)

	args := []any{
		// 'a' CTE
		project, root,
		// 'b' join
		project, root,
		// keys subquery
		project, root,
	}
	if nameArg != nil {
		args = append(args, nameArg)
	}
	args = append(args, statusArgs...)
	// phase bias + limit/offset
	args = append(args,
		phaseGuard, preferredPhase,
		phaseGuard, preferredPhase,
		limit, offset,
	)

	var rows []LatestSubmissionRow
	if err := r.db.WithContext(ctx).Raw(q, args...).Scan(&rows).Error; err != nil {
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

	// total for pagination
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

	// page keys (one row per asset)
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

	// build dynamic WHERE ( ... OR ... ) for only this page's assets
	var sb strings.Builder
	var params []any

	sb.WriteString(`
WITH latest_phase AS (
  SELECT
    ri.project,
    ri.root,
    ri.group_1,
    ri.relation,
    ri.phase,
    ri.work_status,
    ri.approval_status,
    ri.submitted_at_utc,
    ri.modified_at_utc,
    JSON_UNQUOTE(JSON_EXTRACT(ri.` + "`groups`" + `, '$[0]')) AS leaf_group_name,
    gc.path AS group_category_path,
    SUBSTRING_INDEX(gc.path, '/', 1) AS top_group_node,
    ROW_NUMBER() OVER (
      PARTITION BY ri.project, ri.root, ri.group_1, ri.relation, ri.phase
      ORDER BY ri.modified_at_utc DESC
    ) AS rn
  FROM t_review_info AS ri
  LEFT JOIN t_group_category_group AS gcg
         ON gcg.project = ri.project
        AND gcg.deleted = 0
        AND gcg.path = JSON_UNQUOTE(JSON_EXTRACT(ri.` + "`groups`" + `, '$[0]'))
  LEFT JOIN t_group_category AS gc
         ON gc.id = gcg.group_category_id
        AND gc.deleted = 0
        AND gc.root = 'assets'
  WHERE ri.project = ? AND ri.root = ? AND ri.deleted = 0
    AND (
`)

	params = append(params, project, root)

	for i, k := range keys {
		if i > 0 {
			sb.WriteString("      OR ")
		}
		sb.WriteString("(ri.group_1 = ? AND ri.relation = ?)\n")
		params = append(params, k.Group1, k.Relation)
	}

	sb.WriteString(`    )
)
SELECT
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
FROM latest_phase
WHERE rn = 1;
`)

	var phases []phaseRow
	if err := r.db.WithContext(ctx).Raw(sb.String(), params...).Scan(&phases).Error; err != nil {
		return nil, 0, fmt.Errorf("ListAssetsPivot.phaseFetch: %w", err)
	}

	// stitch phases into pivot rows
	type keyStruct struct {
		p, r, g, rel string
	}
	m := make(map[keyStruct]*AssetPivot, len(keys))
	ordered := make([]AssetPivot, 0, len(keys))

	for _, k := range keys {
		id := keyStruct{k.Project, k.Root, k.Group1, k.Relation}
		ap := &AssetPivot{
			Root:     k.Root,
			Project:  k.Project,
			Group1:   k.Group1,
			Relation: k.Relation,
		}
		m[id] = ap
		ordered = append(ordered, *ap)
	}

	for _, pr := range phases {
		id := keyStruct{pr.Project, pr.Root, pr.Group1, pr.Relation}
		if ap, ok := m[id]; ok {
			// grouping info once
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

	// copy back filled pivots in original key order
	for i := range ordered {
		id := keyStruct{
			ordered[i].Project,
			ordered[i].Root,
			ordered[i].Group1,
			ordered[i].Relation,
		}
		if filled, ok := m[id]; ok {
			ordered[i] = *filled
		}
	}

	return ordered, total, nil
}
