/* ======================= PIVOT STRUCTS ======================= */

type LatestSubmissionRow struct {
	Root           string     `gorm:"column:root"`
	Project        string     `gorm:"column:project"`
	Group1         string     `gorm:"column:group_1"`
	Relation       string     `gorm:"column:relation"`
	Phase          string     `gorm:"column:phase"`
	SubmittedAtUTC *time.Time `gorm:"column:submitted_at_utc"`
}

type AssetPivot struct {
	Root     string `json:"root"`
	Project  string `json:"project"`
	Group1   string `json:"group_1"`
	Relation string `json:"relation"`

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

/* ======================= GROUP CATEGORY ======================= */

type SortDirection string

const (
	SortASC  SortDirection = "ASC"
	SortDESC SortDirection = "DESC"
)

type GroupedAssetBucket struct {
	TopGroupNode string       `json:"top_group_node"`
	ItemCount    int          `json:"item_count"`
	Items        []AssetPivot `json:"items"`
	TotalCount   *int         `json:"total_count"`
}

func GroupAndSortByTopNode(rows []AssetPivot, dir SortDirection) []GroupedAssetBucket {

	grouped := map[string][]AssetPivot{}
	order := []string{}

	for _, r := range rows {
		key := strings.TrimSpace(r.TopGroupNode)
		if key == "" {
			key = "Unassigned"
		}
		if _, ok := grouped[key]; !ok {
			grouped[key] = []AssetPivot{}
			order = append(order, key)
		}
		grouped[key] = append(grouped[key], r)
	}

	isUnassigned := func(s string) bool {
		return strings.EqualFold(strings.TrimSpace(s), "unassigned")
	}

	sort.Slice(order, func(i, j int) bool {
		ai, aj := order[i], order[j]
		if isUnassigned(ai) && !isUnassigned(aj) {
			return false
		}
		if !isUnassigned(ai) && isUnassigned(aj) {
			return true
		}
		return strings.ToLower(ai) < strings.ToLower(aj)
	})

	for k := range grouped {
		sort.SliceStable(grouped[k], func(i, j int) bool {
			if dir == SortDESC {
				return grouped[k][i].Group1 > grouped[k][j].Group1
			}
			return grouped[k][i].Group1 < grouped[k][j].Group1
		})
	}

	out := make([]GroupedAssetBucket, 0, len(order))
	for _, k := range order {
		out = append(out, GroupedAssetBucket{
			TopGroupNode: k,
			Items:        grouped[k],
		})
	}

	return out
}

/* ======================= FILTER HELPERS ======================= */

// preferredPhase is ignored in filtering, only used for sort priority elsewhere.
func buildPhaseAwareStatusWhere(
	_ string,
	approvalStatuses []string,
	workStatuses []string,
) (string, []any) {

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

/* ======================= ORDER BY BUILDER ======================= */

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

	case "submitted_at_utc", "modified_at_utc", "phase":
		return col(key) + " " + dir

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

	case "mdl_submitted", "rig_submitted", "bld_submitted", "dsn_submitted", "ldv_submitted":
		return fmt.Sprintf(
			"(%s IS NULL) ASC, %s %s, LOWER(%s) ASC",
			col("submitted_at_utc"),
			col("submitted_at_utc"), dir,
			col("group_1"),
		)

	case "mdl_work", "rig_work", "bld_work", "dsn_work", "ldv_work", "work_status":
		return fmt.Sprintf(
			"(%s IS NULL) ASC, LOWER(%s) %s, LOWER(%s) ASC",
			col("work_status"),
			col("work_status"), dir,
			col("group_1"),
		)

	case "mdl_appr", "rig_appr", "bld_appr", "dsn_appr", "ldv_appr":
		return fmt.Sprintf(
			"(%s IS NULL) ASC, LOWER(%s) %s, LOWER(%s) ASC",
			col("approval_status"),
			col("approval_status"), dir,
			col("group_1"),
		)

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

/* ======================= COUNT LATEST ======================= */

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
		latestPhase = latestPhase.Where(
			"LOWER(group_1) LIKE ?",
			strings.ToLower(strings.TrimSpace(assetNameKey))+"%",
		)
	}

	filteredAssets := db.Model(&model.ReviewInfo{}).
		Select("project, root, group_1, relation").
		Table("(?) AS latest_phase", latestPhase).
		Where("rn = 1")

	if len(approvalStatuses) > 0 || len(workStatuses) > 0 {
		statusWhere, statusArgs := buildPhaseAwareStatusWhere(
			preferredPhase,
			approvalStatuses,
			workStatuses,
		)
		if statusWhere != "" {
			filteredAssets = filteredAssets.Where(
				statusWhere[4:], // remove leading "AND "
				statusArgs...,
			)
		}
	}

	filteredAssets = filteredAssets.
		Group("project, root, group_1, relation")

	var total int64
	err := db.Table("(?) AS x", filteredAssets).Count(&total).Error
	if err != nil {
		return 0, fmt.Errorf("CountLatestSubmissions: %w", err)
	}

	return total, nil
}

/* ======================= LIST LATEST (DYNAMIC) ======================= */

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

	// normalize direction
	direction = strings.ToUpper(strings.TrimSpace(direction))
	if direction != "ASC" && direction != "DESC" {
		direction = "ASC"
	}

	phaseGuard := 0
	if preferredPhase == "" || strings.EqualFold(preferredPhase, "none") {
		phaseGuard = 1
	}

	orderClauseInner := buildOrderClause("b", orderKey, direction)

	db := r.db.WithContext(ctx)

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
		latestPhaseKeys = latestPhaseKeys.Where(
			"LOWER(group_1) LIKE ?",
			strings.ToLower(strings.TrimSpace(assetNameKey))+"%",
		)
	}

	keysSubquery := db.Model(&model.ReviewInfo{}).
		Select("project, root, group_1, relation").
		Table("(?) AS latest_phase", latestPhaseKeys).
		Where("rn = 1")

	if len(approvalStatuses) > 0 || len(workStatuses) > 0 {
		statusWhere, statusArgs := buildPhaseAwareStatusWhere(
			preferredPhase,
			approvalStatuses,
			workStatuses,
		)
		if statusWhere != "" {
			keysSubquery = keysSubquery.Where(statusWhere[4:], statusArgs...)
		}
	}

	keysSubquery = keysSubquery.
		Group("project, root, group_1, relation")

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

	orderedQuery := db.Model(&model.ReviewInfo{}).
		Select("b.*").
		Table("(?) AS a", phaseMaxQuery).
		Joins(`
			LEFT JOIN (?) AS b
			ON a.project = b.project
			AND a.root = b.root
			AND a.group_1 = b.group_1
			AND a.relation = b.relation
			AND a.phase = b.phase
			AND a.modified_at_utc = b.modified_at_utc
		`, phaseDataQuery).
		Joins(`
			INNER JOIN (?) AS fk
			ON b.project = fk.project
			AND b.root = fk.root
			AND b.group_1 = fk.group_1
			AND b.relation = fk.relation
		`, keysSubquery).
		Order(orderClauseInner)

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
					LOWER(b.group_1) ASC,
					LOWER(b.relation) ASC,
					b.modified_at_utc DESC
			) AS _rank
		`, phaseGuard, preferredPhase).
		Table("(?) AS b", orderedQuery)

	var rows []LatestSubmissionRow
	err := db.
		Table("(?) AS ranked", rankedQuery).
		Select("root, project, group_1, relation, phase, submitted_at_utc").
		Where("_rank = 1").
		Order("_rank ASC"). // ✅ FIXED (was _order)
		Limit(limit).
		Offset(offset).
		Scan(&rows).Error

	if err != nil {
		return nil, fmt.Errorf("ListLatestSubmissionsDynamic: %w", err)
	}

	return rows, nil
}

/* ======================= FINAL PIVOT ======================= */

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

	var orConditions []clause.Expression
	for _, k := range keys {
		orConditions = append(orConditions, clause.And(
			clause.Eq{Column: "ri.group_1", Value: k.Group1},
			clause.Eq{Column: "ri.relation", Value: k.Relation},
		))
	}

	// ✅ SAFETY GUARD
	if len(orConditions) == 0 {
		return []AssetPivot{}, total, nil
	}

	db := r.db.WithContext(ctx)

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
			JSON_UNQUOTE(JSON_EXTRACT(ri.groups, '$[0]')) AS leaf_group_name,
			gc.path AS group_category_path,
			SUBSTRING_INDEX(gc.path, '/', 1) AS top_group_node,
			ROW_NUMBER() OVER (
				PARTITION BY ri.project, ri.root, ri.group_1, ri.relation, ri.phase
				ORDER BY ri.modified_at_utc DESC
			) AS rn
		`).
		Joins(`
			LEFT JOIN t_group_category_group AS gcg
			ON gcg.project = ri.project
			AND gcg.deleted = 0
			AND gcg.path = JSON_UNQUOTE(JSON_EXTRACT(ri.groups, '$[0]'))
		`).
		Joins(`
			LEFT JOIN t_group_category AS gc
			ON gc.id = gcg.group_category_id
			AND gc.deleted = 0
			AND gc.root = 'assets'
		`).
		Where("ri.project = ?", project).
		Where("ri.root = ?", root).
		Where("ri.deleted = 0").
		Where(clause.Or(orConditions...))

	var phases []struct {
		Project           string     `gorm:"column:project"`
		Root              string     `gorm:"column:root"`
		Group1            string     `gorm:"column:group_1"`
		Relation          string     `gorm:"column:relation"`
		Phase             string     `gorm:"column:phase"`
		WorkStatus        *string    `gorm:"column:work_status"`
		ApprovalStatus    *string    `gorm:"column:approval_status"`
		SubmittedAtUTC    *time.Time `gorm:"column:submitted_at_utc"`
		LeafGroupName     string     `gorm:"column:leaf_group_name"`
		GroupCategoryPath string     `gorm:"column:group_category_path"`
		TopGroupNode      string     `gorm:"column:top_group_node"`
	}

	err = db.
		Table("(?) AS latest_phase", latestPhaseQuery).
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

	type keyStruct struct {
		p, r, g, rel string
	}

	m := make(map[keyStruct]*AssetPivot, len(keys))
	orderedPtrs := make([]*AssetPivot, 0, len(keys))

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

	for _, pr := range phases {
		id := keyStruct{pr.Project, pr.Root, pr.Group1, pr.Relation}
		if ap, ok := m[id]; ok {

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

	out := make([]AssetPivot, len(orderedPtrs))
	for i, ap := range orderedPtrs {
		out[i] = *ap
	}

	return out, total, nil
}
