// ========================================================================
// ========= Asset Review Pivot Listing ==================================
// ========================================================================

// ---------- Structs for Query Results ----------
type LatestSubmissionRow struct {
	Root           string     `json:"root"              gorm:"column:root"`
	Project        string     `json:"project"           gorm:"column:project"`
	Group1         string     `json:"group_1"           gorm:"column:group_1"`
	Relation       string     `json:"relation"          gorm:"column:relation"`
	Phase          string     `json:"phase"             gorm:"column:phase"`
	SubmittedAtUTC *time.Time `json:"submitted_at_utc"  gorm:"column:submitted_at_utc"`
}

// ---------- Pivot Result Struct ----------
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

// ---------- Phase Row Struct ----------
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

// ========================================================================
// ======================= Helper Builders =================================
// ========================================================================

// Asset-name search on group_1 / relation
func buildAssetNameWhere(assetNameKey string) (string, []any) {
	assetNameKey = strings.TrimSpace(assetNameKey)
	if assetNameKey == "" {
		return "", nil
	}

	like := "%" + strings.ToLower(assetNameKey) + "%"
	return "(LOWER(group_1) LIKE ? OR LOWER(relation) LIKE ?)", []any{like, like}
}

// Status filters (no phase clause here – phase bias is handled elsewhere)
func buildPhaseAwareStatusWhere(preferredPhase string, approvalStatuses, workStatuses []string) (string, []any) {
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

	// 🚫 DO NOT add any phase clause here

	if c, a := buildIn("approval_status", approvalStatuses); c != "" {
		clauses = append(clauses, c)
		args = append(args, a...)
	}
	if c, a := buildIn("work_status", workStatuses); c != "" {
		clauses = append(clauses, c)
		args = append(args, a...)
	}

	if len(clauses) == 0 {
		return "", nil
	}
	return "(" + strings.Join(clauses, " AND ") + ")", args
}

// ---------- Dynamic Sorting Function ----------
func buildOrderClause(alias, key, dir string) string {
	dir = strings.ToUpper(strings.TrimSpace(dir))
	if dir != "ASC" && dir != "DESC" {
		dir = "ASC"
	}
	col := func(c string) string {
		if alias != "" {
			return alias + "." + c
		}
		return c
	}

	switch key {
	// Generic Sorts (use column directly)
	case "submitted_at_utc", "modified_at_utc", "phase":
		return col(key) + " " + dir

	// Asset Name/Relation Sorts (use compound keys)
	case "group1_only":
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir, col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	case "relation_only":
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("relation"), dir, col("group_1"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	case "group_rel_submitted":
		return fmt.Sprintf("LOWER(%s) ASC, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)

	// Phase-Specific Sorts (use generic work/submitted status columns)
	case "mdl_submitted", "rig_submitted", "bld_submitted", "dsn_submitted", "ldv_submitted":
		return fmt.Sprintf("(%s IS NULL) ASC, %s %s, LOWER(%s) ASC, LOWER(%s) ASC",
			col("submitted_at_utc"), col("submitted_at_utc"), dir, col("group_1"), col("relation"))

	case "mdl_work_status", "rig_work_status", "bld_work_status", "dsn_work_status", "ldv_work_status":
		return fmt.Sprintf("(%s IS NULL) ASC, %s %s, LOWER(%s) ASC, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("work_status"), col("work_status"), dir, col("group_1"), col("relation"),
			col("submitted_at_utc"), col("submitted_at_utc"), dir)

	// Default sort
	default:
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir, col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	}
}

// ========================================================================
// ======================= Core Queries ===================================
// ========================================================================

// ---------- Count (for pagination total) ----------
func (r *ReviewInfo) CountLatestSubmissions(
	ctx context.Context,
	project, root string,
	assetNameKey string,
	approvalStatuses, workStatuses []string,
) (int64, error) {
	if project == "" {
		return 0, fmt.Errorf("project is required")
	}
	if root == "" {
		root = "assets"
	}

	nameWhere, nameArgs := buildAssetNameWhere(assetNameKey)
	statusWhere, statusArgs := buildPhaseAwareStatusWhere("", approvalStatuses, workStatuses)

	conds := []string{}
	if nameWhere != "" {
		conds = append(conds, nameWhere)
	}
	if statusWhere != "" {
		conds = append(conds, statusWhere)
	}

	whereExtra := ""
	if len(conds) > 0 {
		whereExtra = " AND " + strings.Join(conds, " AND ")
	}

	const tpl = `
SELECT COUNT(*) FROM (
	SELECT project, root, group_1, relation
	FROM t_review_info
	WHERE project = ? AND root = ? AND deleted = 0
	%s
	GROUP BY project, root, group_1, relation
) AS x;`

	sql := fmt.Sprintf(tpl, whereExtra)

	args := []any{project, root}
	args = append(args, nameArgs...)
	args = append(args, statusArgs...)

	var total int64
	if err := r.db.WithContext(ctx).Raw(sql, args...).Scan(&total).Error; err != nil {
		return 0, fmt.Errorf("CountLatestSubmissions: %w", err)
	}
	return total, nil
}

// ---------- ListLatestSubmissionsDynamic (small version) ----------
func (r *ReviewInfo) ListLatestSubmissionsDynamic(
	ctx context.Context,
	project string,
	root string,
	preferredPhase string, // "mdl" | "rig" | ... | "none"
	orderKey string,
	direction string,
	limit, offset int,
	assetNameKey string,
	approvalStatuses, workStatuses []string,
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

	phaseGuard := 0
	if preferredPhase == "" || strings.EqualFold(preferredPhase, "none") {
		phaseGuard = 1
	}

	// Build filters
	nameWhere, nameArgs := buildAssetNameWhere(assetNameKey)
	statusWhere, statusArgs := buildPhaseAwareStatusWhere(preferredPhase, approvalStatuses, workStatuses)

	conds := []string{}
	if nameWhere != "" {
		conds = append(conds, nameWhere)
	}
	if statusWhere != "" {
		conds = append(conds, statusWhere)
	}

	whereExtra := ""
	if len(conds) > 0 {
		whereExtra = " AND " + strings.Join(conds, " AND ")
	}

	// ORDER BY on the collapsed rows uses alias "x"
	orderClause := buildOrderClause("x", orderKey, direction)

	q := fmt.Sprintf(`
WITH ranked AS (
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
			PARTITION BY project, root, group_1, relation
			ORDER BY
				CASE
					WHEN ? = 1 THEN 0
					WHEN phase = ? THEN 0 ELSE 1
				END,
				modified_at_utc DESC
		) AS rn
	FROM t_review_info
	WHERE
		project = ? AND root = ? AND deleted = 0
		%s
)
SELECT
	x.root,
	x.project,
	x.group_1,
	x.relation,
	x.phase,
	x.submitted_at_utc
FROM ranked AS x
WHERE x.rn = 1
ORDER BY %s
LIMIT ? OFFSET ?;
`, whereExtra, orderClause)

	args := []any{
		phaseGuard, preferredPhase, // CASE in window
		project, root,              // WHERE base
	}
	args = append(args, nameArgs...)
	args = append(args, statusArgs...)
	args = append(args, limit, offset)

	var rows []LatestSubmissionRow
	if err := r.db.WithContext(ctx).Raw(q, args...).Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("ListLatestSubmissionsDynamic: %w", err)
	}
	return rows, nil
}

// ---------- ListAssetsPivot (pivot fill, slim version) ----------
func (r *ReviewInfo) ListAssetsPivot(
	ctx context.Context,
	project, root, preferredPhase, orderKey, direction string,
	limit, offset int,
	assetNameKey string,
	approvalStatuses, workStatuses []string,
) ([]AssetPivot, int64, error) {

	// 1) Total count with filters (used for pagination UI)
	total, err := r.CountLatestSubmissions(
		ctx,
		project,
		root,
		assetNameKey,
		approvalStatuses,
		workStatuses,
	)
	if err != nil {
		return nil, 0, err
	}

	// 2) Page of "keys": one representative row per asset
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

	// 3) Batch fetch latest row per phase for only these assets
	var sb strings.Builder
	var params []any

	sb.WriteString(`
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
	WHERE project = ? AND root = ? AND deleted = 0
		AND (
`)
	params = append(params, project, root)

	for i, k := range keys {
		if i > 0 {
			sb.WriteString(" OR ")
		}
		sb.WriteString("(group_1 = ? AND relation = ?)")
		params = append(params, k.Group1, k.Relation)
	}

	sb.WriteString(`
		)
)
SELECT
	project,
	root,
	group_1,
	relation,
	phase,
	work_status,
	approval_status,
	submitted_at_utc
FROM latest_phase
WHERE rn = 1;
`)

	var phases []phaseRow
	if err := r.db.WithContext(ctx).Raw(sb.String(), params...).Scan(&phases).Error; err != nil {
		return nil, 0, fmt.Errorf("ListAssetsPivot.phaseFetch: %w", err)
	}

	// 4) Pivot in Go, preserving order from "keys"
	type assetKey struct {
		p, r, g, rel string
	}

	m := make(map[assetKey]*AssetPivot, len(keys))
	orderedKeys := make([]assetKey, 0, len(keys))

	for _, k := range keys {
		id := assetKey{k.Project, k.Root, k.Group1, k.Relation}
		if _, exists := m[id]; !exists {
			m[id] = &AssetPivot{
				Root:     k.Root,
				Project:  k.Project,
				Group1:   k.Group1,
				Relation: k.Relation,
			}
			orderedKeys = append(orderedKeys, id)
		}
	}

	for _, pr := range phases {
		id := assetKey{pr.Project, pr.Root, pr.Group1, pr.Relation}
		ap, ok := m[id]
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

	// 5) Build final slice in the same order as "keys"
	result := make([]AssetPivot, 0, len(orderedKeys))
	for _, id := range orderedKeys {
		if ap, ok := m[id]; ok {
			result = append(result, *ap)
		}
	}

	return result, total, nil
}
