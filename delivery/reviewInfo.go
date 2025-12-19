package delivery

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	// IMPORTANT:
	// Replace this import path with your real usecase package path.
	// Example:
	// "github.com/PolygonPictures/central30-web/front/usecase"
	"github.com/PolygonPictures/central30-web/front/usecase"
)

// ========================================================================
// ReviewInfoDelivery
// ========================================================================

// If your project already has ReviewInfoDelivery struct in another file,
// DO NOT duplicate it.
// Instead: copy only the handler + helpers below.
//
// If you don't have it yet, keep this struct.
type ReviewInfoDelivery struct {
	// ✅ This must match your actual field.
	// If you are using repository directly, rename this to your repo field.
	reviewInfoUsecase usecase.ReviewInfoUsecase
}

func NewReviewInfoDelivery(uc usecase.ReviewInfoUsecase) *ReviewInfoDelivery {
	return &ReviewInfoDelivery{
		reviewInfoUsecase: uc,
	}
}

// Optional route bind helper (use if you want).
func (d *ReviewInfoDelivery) RegisterRoutes(api *gin.RouterGroup) {
	// Example:
	// GET /api/projects/:project/reviews/assets/pivot
	api.GET("/projects/:project/reviews/assets/pivot", d.ListAssetsPivot)
}

// ========================================================================
// HANDLER: ListAssetsPivot
// ========================================================================

func (d *ReviewInfoDelivery) ListAssetsPivot(c *gin.Context) {
	// ---- Required path param ----
	project := strings.TrimSpace(c.Param("project"))
	if project == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project is required in the path"})
		return
	}

	// ---- Query: root ----
	root := strings.TrimSpace(c.DefaultQuery("root", "assets"))
	if root == "" {
		root = "assets"
	}

	// ---- Pagination ----
	page := mustAtoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}

	perPage := clampPerPage(mustAtoi(c.DefaultQuery("per_page", "15")))
	limit := perPage
	offset := (page - 1) * perPage

	// ---- Sorting ----
	sortParam := c.DefaultQuery("sort", "group_1")
	dirParam := c.DefaultQuery("dir", "ASC")

	orderKey := normalizeSortKey(sortParam)
	dir := normalizeDir(dirParam)

	// ---- Filters ----
	assetNameKey := strings.TrimSpace(c.Query("name"))
	approvalStatuses := parseStatusParam(c, "approval_status")
	workStatuses := parseStatusParam(c, "work_status")

	// ---- Preferred phase ----
	phaseParam := strings.TrimSpace(c.Query("phase"))
	preferredPhase := phaseParam
	if preferredPhase == "" {
		preferredPhase = "none"
	}

	// ---- timeout ----
	ctx, cancel := context.WithTimeout(c.Request.Context(), 7*time.Second)
	defer cancel()

	// =====================================================================
	// IMPORTANT: this call must match your real field
	// - If you use a repo directly: d.reviewInfoRepository.ListAssetsPivot(...)
	// - If you use usecase:        d.reviewInfoUsecase.ListAssetsPivot(...)
	// =====================================================================
	assets, total, err := d.reviewInfoUsecase.ListAssetsPivot(
		ctx,
		project, root,
		preferredPhase,
		orderKey, dir,
		limit, offset,
		assetNameKey,
		approvalStatuses,
		workStatuses,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	// ---- Response ----
	c.JSON(http.StatusOK, gin.H{
		"assets":   assets,
		"total":    total,
		"page":     page,
		"per_page": perPage,
		"sort":     sortParam,
		"dir":      strings.ToLower(dir),
		"project":  project,
		"root":     root,
		"has_next": offset+limit < int(total),
		"has_prev": page > 1,
		"page_last": func() int {
			if total <= 0 {
				return 1
			}
			return (int(total) + perPage - 1) / perPage
		}(),
	})
}

// ========================================================================
// HELPERS (kept in delivery so you don't get undefined errors)
// ========================================================================

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

// Map UI sort keys -> backend order keys you already support
func normalizeSortKey(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	switch s {
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

// Supports: ?approval_status=check,review OR multiple query same key if you want later
func parseStatusParam(c *gin.Context, key string) []string {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
