// repository/reviewinfo_query.go
package repository

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

// AssetRow matches the final SELECT columns of your query
type AssetRow struct {
	Root     string `gorm:"column:root" json:"root"`
	Project  string `gorm:"column:project" json:"project"`
	Group1   string `gorm:"column:group_1" json:"group_1"`
	Relation string `gorm:"column:relation" json:"relation"`
}

// ListLatestAssetReviewInfoForAssets runs your original CTE query (logic unchanged)
// but with parameters for project/root/relation/limit/offset.
func (r *ReviewInfo) ListLatestAssetReviewInfoForAssets(
	ctx context.Context,
	db *gorm.DB,
	project, root, relation string,
	limit, offset int,
) ([]AssetRow, error) {
	sql := `
WITH ordered AS (
    SELECT *,
           ROW_NUMBER() OVER (
               ORDER BY submitted_at_utc ASC
           ) AS _order
    FROM (
        SELECT b.*
        FROM (
            SELECT project, root, group_1, relation, phase, MAX(modified_at_utc) AS modified_at_utc
            FROM t_review_info
            WHERE project = ? AND root = ? AND relation = ? AND deleted = 0
            GROUP BY project, root, group_1, relation, phase
        ) AS a
        LEFT JOIN (
            SELECT root, project, group_1, phase, relation, work_status, submitted_at_utc, modified_at_utc, executed_computer
            FROM t_review_info
            WHERE project = ? AND root = ? AND relation = ? AND deleted = 0
        ) AS b
          ON a.project = b.project
         AND a.root = b.root
         AND a.group_1 = b.group_1
         AND a.relation = b.relation
         AND a.phase = b.phase
         AND a.modified_at_utc = b.modified_at_utc
        ORDER BY submitted_at_utc ASC
    ) AS k
),
offset_ordered AS (
    SELECT c.*,
           CASE WHEN c.phase = 'mdl' THEN c._order ELSE 100000 + c._order END AS __order
    FROM ordered c
),
ranked AS (
    SELECT b.*,
           ROW_NUMBER() OVER (
               PARTITION BY b.root, b.project, b.group_1, b.relation
               ORDER BY CASE WHEN b.phase = 'mdl' THEN 0 ELSE 1 END
           ) AS _rank
    FROM offset_ordered b
)
SELECT root, project, group_1, relation
FROM (
    SELECT *
    FROM ranked
    WHERE _rank = 1
) AS t
ORDER BY __order ASC
LIMIT ? OFFSET ?;
`
	var rows []AssetRow
	// args order must match the ? placeholders above
	args := []any{
		// subquery a
		project, root, relation,
		// subquery b
		project, root, relation,
		// pagination
		limit, offset,
	}
	if err := db.WithContext(ctx).Raw(sql, args...).Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("ListLatestAssetReviewInfoForAssets: %w", err)
	}
	return rows, nil
}


// 

// delivery/http/routes.go (or wherever you set up routes)
apiRouter.GET("/api/latest/review-submissions/:project", func(c *gin.Context) {
	ctx := c.Request.Context()

	project := c.Param("project")
	root := c.DefaultQuery("root", "assets")
	relation := c.DefaultQuery("relation", "com")

	// pagination defaults
	limit := 15
	offset := 0
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	if v := c.Query("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}

	repo, err := repository.NewReviewInfo(gormDB) // if you already have it, reuse
	if err != nil {
		c.String(http.StatusInternalServerError, "repo init error: %v", err)
		return
	}

	rows, err := repo.ListLatestAssetReviewInfoForAssets(ctx, gormDB, project, root, relation, limit, offset)
	if err != nil {
		c.String(http.StatusInternalServerError, "db error: %v", err)
		return
	}

	c.JSON(http.StatusOK, rows)
})

// ----
# default: root=assets, relation=com, limit=15, offset=0
curl "http://localhost:8080/api/latest/review-submissions/potoo"

# custom pagination and relation
curl "http://localhost:8080/api/latest/review-submissions/potoo?relation=com&limit=30&offset=0"



