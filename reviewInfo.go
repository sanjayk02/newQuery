package reviewinfo

import (
	"context"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

// Final row model returned to the API.
type ReviewInfo struct {
	Root             string     `json:"root"               gorm:"column:root"`
	Project          string     `json:"project"            gorm:"column:project"`
	Group1           string     `json:"group_1"            gorm:"column:group_1"`
	Relation         string     `json:"relation"           gorm:"column:relation"`
	Phase            string     `json:"phase"              gorm:"column:phase"`
	WorkStatus       string     `json:"work_status"        gorm:"column:work_status"`
	SubmittedAtUTC   *time.Time `json:"submitted_at_utc"   gorm:"column:submitted_at_utc"`
	ModifiedAtUTC    *time.Time `json:"modified_at_utc"    gorm:"column:modified_at_utc"`
	ExecutedComputer string     `json:"executed_computer"  gorm:"column:executed_computer"`
}

// Keys from the first query (ordered list of assets)
type AssetKey struct {
	Root     string `json:"root"`
	Project  string `json:"project"`
	Group1   string `json:"group_1"`
	Relation string `json:"relation"`
}

// Raw rows from the second query (latest per phase)
type PhaseRow struct {
	Root            string     `gorm:"column:root"`
	Project         string     `gorm:"column:project"`
	Group1          string     `gorm:"column:group_1"`
	Relation        string     `gorm:"column:relation"`
	Phase           string     `gorm:"column:phase"`
	WorkStatus      *string    `gorm:"column:work_status"`
	ApprovalStatus  *string    `gorm:"column:approval_status"`
	SubmittedAtUTC  *time.Time `gorm:"column:submitted_at_utc"`
	ModifiedAtUTC   *time.Time `gorm:"column:modified_at_utc"`
	ExecutedComputer *string   `gorm:"column:executed_computer"`
}

// Pivoted row for the grid (one per asset)
type AssetPhaseSummary struct {
	Root     string `json:"root"`
	Project  string `json:"project"`
	Group1   string `json:"group_1"`
	Relation string `json:"relation"`

	MdlWorkStatus, MdlApprovalStatus *string    `json:"mdl_work_status,omitempty" json:"mdl_approval_status,omitempty"`
	MdlSubmittedAtUTC                *time.Time `json:"mdl_submitted_at_utc,omitempty"`

	RigWorkStatus, RigApprovalStatus *string    `json:"rig_work_status,omitempty" json:"rig_approval_status,omitempty"`
	RigSubmittedAtUTC                *time.Time `json:"rig_submitted_at_utc,omitempty"`

	BldWorkStatus, BldApprovalStatus *string    `json:"bld_work_status,omitempty" json:"bld_approval_status,omitempty"`
	BldSubmittedAtUTC                *time.Time `json:"bld_submitted_at_utc,omitempty"`

	DsnWorkStatus, DsnApprovalStatus *string    `json:"dsn_work_status,omitempty" json:"dsn_approval_status,omitempty"`
	DsnSubmittedAtUTC                *time.Time `json:"dsn_submitted_at_utc,omitempty"`

	LdvWorkStatus, LdvApprovalStatus *string    `json:"ldv_work_status,omitempty" json:"ldv_approval_status,omitempty"`
	LdvSubmittedAtUTC                *time.Time `json:"ldv_submitted_at_utc,omitempty"`
}


// --- Your complex query (4 placeholders): WHERE(t1), WHERE(b), FINAL WHERE, ORDER BY ---
const complexReviewInfoQuery = `
WITH max_modified AS (
    SELECT project, root, group_1, relation, phase,
           MAX(modified_at_utc) AS modified_at_utc
    FROM t_review_info AS t1
    WHERE %s
    GROUP BY project, root, group_1, relation, phase
),
latest_reviews AS (
    SELECT b.root, b.project, b.group_1, b.phase, b.relation,
           b.work_status, b.submitted_at_utc, b.modified_at_utc, b.executed_computer
    FROM max_modified a
    JOIN t_review_info b
      ON a.project=b.project AND a.root=b.root AND a.group_1=b.group_1
     AND a.relation=b.relation AND a.phase=b.phase
     AND a.modified_at_utc=b.modified_at_utc
    WHERE %s
),
ordered AS (
    SELECT t1.*, ROW_NUMBER() OVER (ORDER BY t1.group_1 ASC, t1.relation ASC) AS _order
    FROM latest_reviews t1
),
offset_ordered AS (
    SELECT c.*, CASE WHEN c.phase='rel' THEN c._order ELSE 100000 + c._order END AS __order
    FROM ordered c
),
ranked AS (
    SELECT b.*,
           ROW_NUMBER() OVER (
             PARTITION BY b.root, b.project, b.group_1, b.relation
             ORDER BY CASE WHEN b.phase='rel' THEN 0 ELSE 1 END,
                      b.submitted_at_utc DESC,
                      b.modified_at_utc  DESC
           ) AS _rank
    FROM offset_ordered b
)
SELECT
    root              AS root,
    project           AS project,
    group_1           AS group_1,
    relation          AS relation,
    phase             AS phase,
    work_status       AS work_status,
    submitted_at_utc  AS submitted_at_utc,
    modified_at_utc   AS modified_at_utc,
    executed_computer AS executed_computer,
    __order
FROM ( SELECT * FROM ranked WHERE _rank = 1 ) AS t
%s   -- final WHERE (optional; used in filter mode)
%s   -- ORDER BY
LIMIT ? OFFSET ?;
`

// ListLatestSubmissionsWithSort returns page data AND total count.
// preferPhase = true  => phase rows come first (no filtering by phase)
// preferPhase = false => strict filter by phase (only that phase returned)
func (r *ReviewInfoRepository) ListLatestSubmissionsWithSort(
	ctx context.Context,
	db *gorm.DB,
	project string,
	rootParam string,   // optional
	phaseParam string,  // optional (can be "mdl" or "mdl,rig" for prefer mode)
	preferPhase bool,   // usually true; set false to filter strictly by a single phase
	limit, offset int,
	sortParam string,
) (rows []ReviewInfo, total int64, err error) {

	// ---------- 1) Build WHEREs for CTEs ----------
	base := "project = ? AND deleted = 0"
	if rootParam != "" {
		base += " AND root = ?"
	}
	// Only filter phase inside the CTEs when we are in strict filter mode
	if phaseParam != "" && !preferPhase {
		base += " AND phase = ?"
	}

	// Apply aliases
	filterT1 := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(
		base, "project", "t1.project"), "root", "t1.root"), "phase", "t1.phase")
	filterT1 = strings.ReplaceAll(filterT1, "deleted", "t1.deleted")

	filterB := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(
		base, "project", "b.project"), "root", "b.root"), "phase", "b.phase")
	filterB = strings.ReplaceAll(filterB, "deleted", "b.deleted")

	// ---------- 2) Final WHERE (strict filter mode only) ----------
	finalWhere := ""
	if phaseParam != "" && !preferPhase {
		finalWhere = "WHERE t.phase = ?"
	}

	// ---------- 3) ORDER BY whitelist + parameterized booster ----------
	// Use COALESCE for null-safe time sorts
	allowed := map[string]string{
		"group_1":           "t.group_1",
		"relation":          "t.relation",
		"phase":             "t.phase",
		"work":              "t.work_status",
		"work_status":       "t.work_status",
		"submitted":         "COALESCE(t.submitted_at_utc, t.modified_at_utc)",
		"submitted_at_utc":  "COALESCE(t.submitted_at_utc, t.modified_at_utc)",
		"modified":          "COALESCE(t.modified_at_utc, t.submitted_at_utc)",
		"modified_at_utc":   "COALESCE(t.modified_at_utc, t.submitted_at_utc)",
		"executed_computer": "t.executed_computer",
		"__order":           "t.__order",
	}

	// Phase booster for prefer mode — parameterized and supports multi-phase "mdl,rig"
	boosterSQL := ""
	boosterParams := []interface{}{}
	if phaseParam != "" && preferPhase {
		phases := make([]string, 0, 4)
		for _, p := range strings.Split(phaseParam, ",") {
			p = strings.TrimSpace(p)
			if p != "" {
				phases = append(phases, p)
			}
		}
		if len(phases) == 1 {
			boosterSQL = "CASE WHEN t.phase = ? THEN 0 ELSE 1 END, "
			boosterParams = append(boosterParams, phases[0])
		} else if len(phases) > 1 {
			qs := strings.Repeat("?,", len(phases))
			qs = qs[:len(qs)-1]
			boosterSQL = fmt.Sprintf("CASE WHEN t.phase IN (%s) THEN 0 ELSE 1 END, ", qs)
			for _, p := range phases {
				boosterParams = append(boosterParams, p)
			}
		}
	}

	orderBy := "ORDER BY t.__order ASC, t.group_1 ASC, t.relation ASC"

	if sortParam != "" {
		dir := "ASC"
		field := sortParam
		if strings.HasPrefix(field, "-") {
			dir = "DESC"
			field = strings.TrimPrefix(field, "-")
		}
		if col, ok := allowed[field]; ok {
			orderBy = fmt.Sprintf("ORDER BY %s%s %s, t.group_1 ASC, t.relation ASC", boosterSQL, col, dir)
		} else if boosterSQL != "" {
			orderBy = "ORDER BY " + boosterSQL + " t.group_1 ASC, t.relation ASC"
		}
	} else if boosterSQL != "" {
		orderBy = "ORDER BY " + boosterSQL + " t.group_1 ASC, t.relation ASC"
	}

	// ---------- 4) Assemble SQL ----------
	sql := fmt.Sprintf(complexReviewInfoQuery, filterT1, filterB, finalWhere, orderBy)

	// ---------- 5) Build params (t1 + b + finalWhere + booster + limit/offset) ----------
	build := func() []interface{} {
		ps := []interface{}{project}
		if rootParam != "" {
			ps = append(ps, rootParam)
		}
		if phaseParam != "" && !preferPhase {
			ps = append(ps, phaseParam)
		}
		return ps
	}
	params := append([]interface{}{}, build()...) // t1
	params = append(params, build()...)           // b
	if phaseParam != "" && !preferPhase {
		params = append(params, phaseParam) // final WHERE
	}
	params = append(params, boosterParams...)     // prefer-phase booster
	params = append(params, limit, offset)        // LIMIT/OFFSET

	// ---------- 6) Execute page query ----------
	var out []ReviewInfo
	if err = db.WithContext(ctx).Raw(sql, params...).Scan(&out).Error; err != nil {
		return nil, 0, err
	}

	// ---------- 7) Total count for pagination ----------
	// Count distinct assets under the same filter mode.
	// In prefer mode: phase is NOT part of the filter.
	// In strict filter mode: phase IS part of the filter.
	countSQL := `
SELECT COUNT(*) FROM (
  SELECT project, root, group_1, relation
  FROM t_review_info
  WHERE project = ? AND deleted = 0
    %s
  GROUP BY project, root, group_1, relation
) x;
`
	extra := ""
	var countArgs []interface{}
	countArgs = append(countArgs, project)
	if rootParam != "" {
		extra += " AND root = ?"
		countArgs = append(countArgs, rootParam)
	}
	if phaseParam != "" && !preferPhase {
		extra += " AND phase = ?"
		countArgs = append(countArgs, phaseParam)
	}
	countSQL = fmt.Sprintf(countSQL, extra)

	var totalCount int64
	if err2 := db.WithContext(ctx).Raw(countSQL, countArgs...).Scan(&totalCount).Error; err2 != nil {
		// fallback so the API still works even if count fails
		totalCount = int64(len(out))
	}

	return out, totalCount, nil
}

package main

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	reviewinfo "your/module/path/reviewinfo" // TODO: replace with your module path
)

// normalize "sort" and "dir/desc" into "-field" or "field"
func canonicalizeSort(sortCSV, dirCSV, descFlag string) string {
	sortCSV = strings.TrimSpace(sortCSV)
	dirCSV = strings.TrimSpace(strings.ToUpper(dirCSV))
	descFlag = strings.TrimSpace(strings.ToLower(descFlag))
	if sortCSV == "" {
		return ""
	}
	if strings.HasPrefix(sortCSV, "-") && dirCSV == "" && descFlag == "" {
		return sortCSV
	}
	field := strings.TrimPrefix(sortCSV, "-")
	isDesc := dirCSV == "DESC" || descFlag == "true" || descFlag == "1" || descFlag == "yes"
	if isDesc {
		return "-" + field
	}
	return field
}

func main() {
	// Example DSN; set your own.
	dsn := "user:pass@tcp(127.0.0.1:3306)/yourdb?parseTime=true&charset=utf8mb4&loc=UTC"
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalln("DB open:", err)
	}

	repo := &reviewinfo.ReviewInfoRepository{}

	r := gin.Default()

	// GET /api/latest/review-submissions/:project?root=assets&phase=mdl&sort=submitted&dir=desc&page=1&per_page=15
	r.GET("/api/latest/review-submissions/:project", func(c *gin.Context) {
		project := strings.TrimSpace(c.Param("project"))
		if project == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "project is required in path"})
			return
		}
		rootParam := c.Query("root")
		phaseParam := c.Query("phase")

		// prefer phase by default; set mode=filter to return only that phase
		preferPhase := true
		if strings.EqualFold(c.DefaultQuery("mode", ""), "filter") {
			preferPhase = false
		}

		// pagination: page/per_page
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		if page <= 0 {
			page = 1
		}
		perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))
		if perPage <= 0 {
			perPage = 50
		}
		if perPage > 500 {
			perPage = 500
		}
		offset := perPage * (page - 1)

		// sort handling
		sortParam := canonicalizeSort(
			c.DefaultQuery("sort", "group_1"),
			c.DefaultQuery("dir", ""),
			c.DefaultQuery("desc", ""),
		)

		rows, total, err := repo.ListLatestSubmissionsWithSort(
			c.Request.Context(),
			db,
			project,
			rootParam,
			phaseParam,
			preferPhase,
			perPage,
			offset,
			sortParam,
		)
		if err != nil {
			log.Printf("[latest-submissions] error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal database error"})
			return
		}

		c.IndentedJSON(http.StatusOK, gin.H{
			"project":  project,
			"root":     rootParam,
			"phase":    phaseParam,
			"mode":     map[bool]string{true: "prefer", false: "filter"}[preferPhase],
			"page":     page,
			"per_page": perPage,
			"total":    total,
			"count":    len(rows),
			"data":     rows,
			"ts":       time.Now().UTC().Format(time.RFC3339),
		})
	})

	_ = r.Run(":4000")
}




// LatestPerPhaseForAssets executes the second query for the given (ordered) assets.
// It returns the latest row per phase for each asset, preserving input order via seq.
func (r *ReviewInfoRepository) LatestPerPhaseForAssets(
	ctx context.Context,
	db *gorm.DB,
	keys []AssetKey, // ordered from first query
) ([]PhaseRow, error) {

	if len(keys) == 0 {
		return []PhaseRow{}, nil
	}

	// Build the sel CTE preserving the input order with seq
	parts := make([]string, 0, len(keys))
	params := make([]interface{}, 0, len(keys)*5)

	for i, k := range keys {
		if i == 0 {
			parts = append(parts, "SELECT ? AS root, ? AS project, ? AS group_1, ? AS relation, ? AS seq")
		} else {
			parts = append(parts, "UNION ALL SELECT ?,?,?,?,?")
		}
		params = append(params, k.Root, k.Project, k.Group1, k.Relation, i+1) // seq = 1..N
	}

	selCTE := strings.Join(parts, "\n")

	sql := fmt.Sprintf(`
WITH sel(root, project, group_1, relation, seq) AS (
  %s
),
max_modified AS (
  SELECT
    b.project, b.root, b.group_1, b.relation, b.phase,
    MAX(b.modified_at_utc) AS modified_at_utc,
    MIN(sel.seq)           AS seq
  FROM t_review_info b
  JOIN sel
    ON  sel.project  = b.project
    AND sel.root     = b.root
    AND sel.group_1  = b.group_1
    AND sel.relation = b.relation
  WHERE b.deleted = 0
  GROUP BY b.project, b.root, b.group_1, b.relation, b.phase
)
SELECT
  b.root, b.project, b.group_1, b.relation, b.phase,
  b.work_status, b.approval_status, b.submitted_at_utc, b.modified_at_utc, b.executed_computer
FROM max_modified a
JOIN t_review_info b
  ON  a.project         = b.project
  AND a.root            = b.root
  AND a.group_1         = b.group_1
  AND a.relation        = b.relation
  AND a.phase           = b.phase
  AND a.modified_at_utc = b.modified_at_utc
ORDER BY a.seq ASC, b.group_1 ASC, b.relation ASC;
`, selCTE)

	var rows []PhaseRow
	if err := db.WithContext(ctx).Raw(sql, params...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

// PivotPhaseRows collapses per-phase rows into a single row per asset.
func PivotPhaseRows(rows []PhaseRow, inputOrder []AssetKey) []AssetPhaseSummary {
	// map for quick merge
	m := make(map[string]*AssetPhaseSummary, len(rows))
	keyOf := func(root, project, g1, rel string) string {
		return root + "|" + project + "|" + g1 + "|" + rel
	}

	for _, r := range rows {
		k := keyOf(r.Root, r.Project, r.Group1, r.Relation)
		dst, ok := m[k]
		if !ok {
			dst = &AssetPhaseSummary{
				Root: r.Root, Project: r.Project, Group1: r.Group1, Relation: r.Relation,
			}
			m[k] = dst
		}
		switch strings.ToLower(r.Phase) {
		case "mdl":
			dst.MdlWorkStatus, dst.MdlApprovalStatus, dst.MdlSubmittedAtUTC = r.WorkStatus, r.ApprovalStatus, r.SubmittedAtUTC
		case "rig":
			dst.RigWorkStatus, dst.RigApprovalStatus, dst.RigSubmittedAtUTC = r.WorkStatus, r.ApprovalStatus, r.SubmittedAtUTC
		case "bld":
			dst.BldWorkStatus, dst.BldApprovalStatus, dst.BldSubmittedAtUTC = r.WorkStatus, r.ApprovalStatus, r.SubmittedAtUTC
		case "dsn":
			dst.DsnWorkStatus, dst.DsnApprovalStatus, dst.DsnSubmittedAtUTC = r.WorkStatus, r.ApprovalStatus, r.SubmittedAtUTC
		case "ldv":
			dst.LdvWorkStatus, dst.LdvApprovalStatus, dst.LdvSubmittedAtUTC = r.WorkStatus, r.ApprovalStatus, r.SubmittedAtUTC
		}
	}

	// emit in the same order as the first query results
	out := make([]AssetPhaseSummary, 0, len(inputOrder))
	for _, k := range inputOrder {
		id := keyOf(k.Root, k.Project, k.Group1, k.Relation)
		if row, ok := m[id]; ok {
			out = append(out, *row)
		} else {
			// include empty row for assets with no phase matches (rare)
			out = append(out, AssetPhaseSummary{
				Root: k.Root, Project: k.Project, Group1: k.Group1, Relation: k.Relation,
			})
		}
	}
	return out
}


// GetAssetsPivotPage runs first query (keys) -> second query (per-phase) -> pivot.
// It returns the ready-to-render grid rows in the same order as the first query.
func (r *ReviewInfoRepository) GetAssetsPivotPage(
	ctx context.Context,
	db *gorm.DB,
	project string,
	root string,
	sortField string,
	sortDir string, // "ASC" or "DESC"
	page int,
	perPage int,
) (data []AssetPhaseSummary, total int64, err error) {

	// 1) Run your first query (already implemented by you)
	keys, total, err := r.ListOrderedAssets(ctx, db, project, root, sortField, sortDir, perPage, (page-1)*perPage)
	if err != nil {
		return nil, 0, fmt.Errorf("first query failed: %w", err)
	}
	if len(keys) == 0 {
		return []AssetPhaseSummary{}, total, nil
	}

	// 2) Second query: latest per phase for those keys (preserves order via sel.seq)
	phaseRows, err := r.LatestPerPhaseForAssets(ctx, db, keys)
	if err != nil {
		return nil, 0, fmt.Errorf("second query failed: %w", err)
	}

	// 3) Pivot rows into one row per asset (MDL/RIG/BLD/DSN/LDV columns)
	data = PivotPhaseRows(phaseRows, keys)
	return data, total, nil
}



// GET /api/assets/:project/pivot?root=assets&sort=group_1&dir=asc&page=1&per_page=15
router.GET("/api/assets/:project/pivot", func(c *gin.Context) {
	project := c.Param("project")
	root := c.DefaultQuery("root", "assets")
	sortField := c.DefaultQuery("sort", "group_1")
	sortDir := strings.ToUpper(c.DefaultQuery("dir", "ASC"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "15"))
	if page <= 0 { page = 1 }
	if perPage <= 0 { perPage = 15 }

	data, total, err := repo.GetAssetsPivotPage(c.Request.Context(), db, project, root, sortField, sortDir, page, perPage)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.IndentedJSON(http.StatusOK, gin.H{
		"project":  project,
		"root":     root,
		"page":     page,
		"per_page": perPage,
		"total":    total,
		"count":    len(data),
		"data":     data,
	})
})
