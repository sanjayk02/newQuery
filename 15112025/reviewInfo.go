// LatestSubmissionRow is the “key” row after dynamic sort.
type LatestSubmissionRow struct {
	Root           string     `json:"root"              gorm:"column:root"`
	Project        string     `json:"project"           gorm:"column:project"`
	Group1         string     `json:"group_1"           gorm:"column:group_1"`
	Relation       string     `json:"relation"          gorm:"column:relation"`
	Phase          string     `json:"phase"             gorm:"column:phase"`
	SubmittedAtUTC *time.Time `json:"submitted_at_utc"  gorm:"column:submitted_at_utc"`
}

// AssetPivot is the full asset row returned to the frontend.
type AssetPivot struct {
	Root     string `json:"root"`
	Project  string `json:"project"`
	Group1   string `json:"group_1"`
	Relation string `json:"relation"`

	MDLWorkStatus     *string    `json:"mdl_work_status"`
	MDLApprovalStatus *string    `json:"mdl_appr_status"`
	MDLSubmittedAtUTC *time.Time `json:"mdl_submitted_at"`

	RIGWorkStatus     *string    `json:"rig_work_status"`
	RIGApprovalStatus *string    `json:"rig_appr_status"`
	RIGSubmittedAtUTC *time.Time `json:"rig_submitted_at"`

	BLDWorkStatus     *string    `json:"bld_work_status"`
	BLDApprovalStatus *string    `json:"bld_appr_status"`
	BLDSubmittedAtUTC *time.Time `json:"bld_submitted_at"`

	DSNWorkStatus     *string    `json:"dsn_work_status"`
	DSNApprovalStatus *string    `json:"dsn_appr_status"`
	DSNSubmittedAtUTC *time.Time `json:"dsn_submitted_at"`

	LDVWorkStatus     *string    `json:"ldv_work_status"`
	LDVApprovalStatus *string    `json:"ldv_appr_status"`
	LDVSubmittedAtUTC *time.Time `json:"ldv_submitted_at"`
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
}


// NOTE: preferredPhase is ignored here – phase is only for sort priority.
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
	// Generic
	case "submitted_at_utc", "modified_at_utc", "phase":
		return col(key) + " " + dir

	// Name / relation
	case "group1_only":
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir, col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	case "relation_only":
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("relation"), dir, col("group_1"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	case "group_rel_submitted":
		return fmt.Sprintf("LOWER(%s) ASC, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)

	// Phase-specific Submitted: date sort, NULLs always last
	case "mdl_submitted", "rig_submitted", "bld_submitted", "dsn_submitted", "ldv_submitted":
		return fmt.Sprintf("(%s IS NULL) ASC, %s %s, LOWER(%s) ASC",
			col("submitted_at_utc"), col("submitted_at_utc"), dir, col("group_1"))

	// WORK columns: alphabetical on work_status, NULLs last
	case "mdl_work", "rig_work", "bld_work", "dsn_work", "ldv_work", "work_status":
		return fmt.Sprintf("(%s IS NULL) ASC, LOWER(%s) %s, LOWER(%s) ASC",
			col("work_status"), col("work_status"), dir, col("group_1"))

	// APPR columns: alphabetical on approval_status, NULLs last
	case "mdl_appr", "rig_appr", "bld_appr", "dsn_appr", "ldv_appr":
		return fmt.Sprintf("(%s IS NULL) ASC, LOWER(%s) %s, LOWER(%s) ASC",
			col("approval_status"), col("approval_status"), dir, col("group_1"))

	default:
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir, col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	}
}

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

	// Name: case-insensitive PREFIX
	nameCond := ""
	var nameArg any
	if strings.TrimSpace(assetNameKey) != "" {
		nameCond = " AND LOWER(group_1) LIKE ?"
		nameArg = strings.ToLower(strings.TrimSpace(assetNameKey)) + "%"
	}

	// Status filter (no phase restriction)
	statusWhere, statusArgs := buildPhaseAwareStatusWhere(preferredPhase, approvalStatuses, workStatuses)

	sql := `
WITH latest_phase AS (
  SELECT project, root, group_1, relation, phase,
         work_status, approval_status, submitted_at_utc, modified_at_utc,
         ROW_NUMBER() OVER (
           PARTITION BY project, root, group_1, relation, phase
           ORDER BY modified_at_utc DESC
         ) rn
  FROM t_review_info
  WHERE project = ? AND root = ? AND deleted = 0` + nameCond + `
)
SELECT COUNT(*) FROM (
  SELECT project, root, group_1, relation
  FROM latest_phase
  WHERE rn = 1` + statusWhere + `
  GROUP BY project, root, group_1, relation
) x;`

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
		limit = 15
	}
	if offset < 0 {
		offset = 0
	}

	// Name prefix
	nameCond := ""
	var nameArg any
	if strings.TrimSpace(assetNameKey) != "" {
		nameCond = " AND LOWER(group_1) LIKE ?"
		nameArg = strings.ToLower(strings.TrimSpace(assetNameKey)) + "%"
	}

	// Status filter
	statusWhere, statusArgs := buildPhaseAwareStatusWhere(preferredPhase, approvalStatuses, workStatuses)

	// Order clause (window + inner)
	orderClauseWindow := buildOrderClause("", orderKey, direction)
	orderClauseInner := buildOrderClause("b", orderKey, direction)

	// phaseGuard: when phase bias is disabled we always pick 0
	phaseGuard := 0
	if preferredPhase != "" && preferredPhase != "none" {
		phaseGuard = 1
	}

	keysSQL := `
WITH latest_phase AS (
  SELECT project, root, group_1, relation, phase,
         work_status, approval_status, submitted_at_utc, modified_at_utc,
         ROW_NUMBER() OVER (
           PARTITION BY project, root, group_1, relation, phase
           ORDER BY modified_at_utc DESC
         ) rn
  FROM t_review_info
  WHERE project = ? AND root = ? AND deleted = 0` + nameCond + `
)
SELECT project, root, group_1, relation
FROM latest_phase
WHERE rn = 1` + statusWhere + `
GROUP BY project, root, group_1, relation`

	q := fmt.Sprintf(`
WITH ordered AS (
  SELECT *, ROW_NUMBER() OVER (ORDER BY %s) AS _order
  FROM (
    SELECT b.*
    FROM (
      SELECT project, root, group_1, relation, phase, MAX(modified_at_utc) AS modified_at_utc
      FROM t_review_info
      WHERE project = ? AND root = ? AND deleted = 0
      GROUP BY project, root, group_1, relation, phase
    ) AS a
    LEFT JOIN (
      SELECT root, project, group_1, phase, relation,
             work_status, approval_status, submitted_at_utc, modified_at_utc, executed_computer
      FROM t_review_info
      WHERE project = ? AND root = ? AND deleted = 0
    ) AS b
      ON a.project = b.project AND a.root = b.root
         AND a.group_1 = b.group_1 AND a.phase = b.phase AND a.relation = b.relation
  ) AS b
),
offset_ordered AS (
  SELECT * FROM ordered
  WHERE _order > ? OFFSET ?
),
ranked AS (
  SELECT b.*,
         ROW_NUMBER() OVER (
           PARTITION BY b.project, b.root, b.group_1, b.relation, b.phase
           ORDER BY CASE WHEN ? = 1 THEN 0 WHEN b.phase = ? THEN 0 ELSE 1 END,
                    LOWER(b.group_1) ASC,
                    LOWER(b.relation) ASC,
                    b.modified_at_utc DESC
         ) AS _rank
  FROM offset_ordered b
)
SELECT root, project, group_1, relation, phase, submitted_at_utc
FROM (SELECT * FROM ranked WHERE _rank = 1) AS t
ORDER BY _order ASC
LIMIT ? OFFSET ?;`, orderClauseWindow, keysSQL, orderClauseInner)

	args := []any{
		// 'a'
		project, root,
		// 'b'
		project, root,
		// keys subquery params (project, root, [nameArg?], statusArgs...)
		project, root,
	}
	if nameArg != nil {
		args = append(args, nameArg)
	}
	args = append(args, statusArgs...)
	// phase offsets + limit/offset
	args = append(args, phaseGuard, preferredPhase, phaseGuard, preferredPhase, limit, offset)

	var rows []LatestSubmissionRow
	if err := r.db.WithContext(ctx).Raw(q, args...).Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("ListLatestSubmissionsDynamic: %w", err)
	}
	return rows, nil
}


func (r *ReviewInfo) ListAssetsPivot(
	ctx context.Context,
	project, root, preferredPhase, orderKey, direction string,
	limit, offset int,
	assetNameKey string,
	approvalStatuses []string,
	workStatuses []string,
) ([]AssetPivot, int64, error) {

	// total = filtered total (name + appr + work)
	total, err := r.CountLatestSubmissions(
		ctx, project, root, assetNameKey, preferredPhase, approvalStatuses, workStatuses,
	)
	if err != nil {
		return nil, 0, err
	}

	// page keys (ordered)
	keys, err := r.ListLatestSubmissionsDynamic(
		ctx, project, root, preferredPhase, orderKey, direction,
		limit, offset, assetNameKey, approvalStatuses, workStatuses,
	)
	if err != nil {
		return nil, 0, err
	}
	if len(keys) == 0 {
		return []AssetPivot{}, total, nil
	}

	// fetch latest-by-phase rows for ONLY those keys
	var sb strings.Builder
	var params []any
	sb.WriteString(`
WITH latest_phase AS (
  SELECT project, root, group_1, relation, phase,
         work_status, approval_status, submitted_at_utc, modified_at_utc,
         ROW_NUMBER() OVER (
           PARTITION BY project, root, group_1, relation, phase
           ORDER BY modified_at_utc DESC
         ) rn
  FROM t_review_info
  WHERE project = ? AND root = ? AND deleted = 0
    AND (
`)
	params = append(params, project, root)

	for i, k := range keys {
		if i > 0 {
			sb.WriteString("      OR ")
		} else {
			sb.WriteString("      ")
		}
		sb.WriteString("(group_1 = ? AND relation = ?)\n")
		params = append(params, k.Group1, k.Relation)
	}

	sb.WriteString(`    )
)
SELECT project, root, group_1, relation, phase, work_status, approval_status, submitted_at_utc
FROM latest_phase
WHERE rn = 1;`)

	var phases []phaseRow
	if err := r.db.WithContext(ctx).Raw(sb.String(), params...).Scan(&phases).Error; err != nil {
		return nil, 0, fmt.Errorf("ListAssetsPivot.phaseFetch: %w", err)
	}

	type key struct{ p, r, g, rel string }
	m := make(map[key]*AssetPivot, len(keys))
	ordered := make([]AssetPivot, 0, len(keys))
	for _, k := range keys {
		id := key{k.Project, k.Root, k.Group1, k.Relation}
		ap := &AssetPivot{Root: k.Root, Project: k.Project, Group1: k.Group1, Relation: k.Relation}
		m[id] = ap
		ordered = append(ordered, *ap)
	}

	for _, pr := range phases {
		id := key{pr.Project, pr.Root, pr.Group1, pr.Relation}
		if ap, ok := m[id]; ok {
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

	for i := range ordered {
		id := key{ordered[i].Project, ordered[i].Root, ordered[i].Group1, ordered[i].Relation}
		if filled, ok := m[id]; ok {
			ordered[i] = *filled
		}
	}

	return ordered, total, nil
}



