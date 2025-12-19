package delivery

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/PolygonPictures/central30-web/front/usecase"
	"github.com/gin-gonic/gin"
)

/* ============================================================================
   DELIVERY STRUCT
============================================================================ */

type ReviewInfoDelivery struct {
	reviewInfoUsecase usecase.ReviewInfoUsecase
}

func NewReviewInfoDelivery(uc usecase.ReviewInfoUsecase) *ReviewInfoDelivery {
	return &ReviewInfoDelivery{
		reviewInfoUsecase: uc,
	}
}

func (d *ReviewInfoDelivery) RegisterRoutes(api *gin.RouterGroup) {
	api.GET("/projects/:project/reviews/assets/pivot", d.ListAssetsPivot)
}

/* ============================================================================
   HANDLER: ListAssetsPivot
============================================================================ */

func (d *ReviewInfoDelivery) ListAssetsPivot(c *gin.Context) {
	// ---- Path param ----
	project := strings.TrimSpace(c.Param("project"))
	if project == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project is required"})
		return
	}

	// ---- Query params ----
	root := strings.TrimSpace(c.DefaultQuery("root", "assets"))

	page := mustAtoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}

	perPage := clampPerPage(mustAtoi(c.DefaultQuery("per_page", "15")))
	offset := (page - 1) * perPage

	sortParam := c.DefaultQuery("sort", "group_1")
	dirParam := c.DefaultQuery("dir", "asc")

	orderKey := normalizeSortKey(sortParam)
	dir := normalizeDir(dirParam)

	assetName := strings.TrimSpace(c.Query("name"))
	approvalStatuses := parseStatusParam(c, "approval_status")
	workStatuses := parseStatusParam(c, "work_status")

	preferredPhase := strings.TrimSpace(c.DefaultQuery("phase", "none"))

	// ---- Context timeout ----
	ctx, cancel := context.WithTimeout(c.Request.Context(), 7*time.Second)
	defer cancel()

	// ---- Usecase call ----
	assets, total, err := d.reviewInfoUsecase.ListAssetsPivot(
		ctx,
		project,
		root,
		preferredPhase,
		orderKey,
		dir,
		perPage,
		offset,
		assetName,
		approvalStatuses,
		workStatuses,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// ---- Response ----
	c.JSON(http.StatusOK, gin.H{
		"assets":   assets,
		"total":    total,
		"page":     page,
		"per_page": perPage,
		"sort":     sortParam,
		"dir":      dir,
		"phase":    preferredPhase,
		"has_next": offset+perPage < int(total),
		"has_prev": page > 1,
	})
}

/* ============================================================================
   HELPERS (REQUIRED — FIXES YOUR BUILD ERRORS)
============================================================================ */

func mustAtoi(s string) int {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return n
}

func clampPerPage(n int) int {
	if n <= 0 {
		return 15
	}
	if n > 200 {
		return 200
	}
	return n
}

func normalizeDir(s string) string {
	s = strings.ToUpper(strings.TrimSpace(s))
	if s != "ASC" && s != "DESC" {
		return "ASC"
	}
	return s
}

func normalizeSortKey(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "group_1", "group1", "name":
		return "group1_only"
	case "relation":
		return "relation_only"
	case "submitted_at_utc":
		return "submitted_at_utc"
	default:
		return "group1_only"
	}
}

func parseStatusParam(c *gin.Context, key string) []string {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if v := strings.TrimSpace(p); v != "" {
			out = append(out, v)
		}
	}
	return out
}
