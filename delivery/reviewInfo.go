package delivery

import (
	"context"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/PolygonPictures/central30-web/front/repository"
	"github.com/PolygonPictures/central30-web/front/usecase"
)

// ========================================================================
// Review Info Delivery
// ========================================================================

type ReviewInfoDelivery struct {
	reviewInfoUsecase usecase.ReviewInfoUsecase
}

func NewReviewInfoDelivery(uc usecase.ReviewInfoUsecase) *ReviewInfoDelivery {
	return &ReviewInfoDelivery{
		reviewInfoUsecase: uc,
	}
}

// ========================================================================
// Assets Pivot API - returns latest review info per asset
// GET /projects/:project/reviews/assets/pivot
// ========================================================================

func (d *ReviewInfoDelivery) ListAssetsPivot(c *gin.Context) {
	// ---- Project ----
	project := strings.TrimSpace(c.Param("project"))
	if project == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project is required in the path"})
		return
	}

	// ---- Root ----
	root := strings.TrimSpace(c.DefaultQuery("root", "assets"))
	if root == "" {
		root = "assets"
	}

	// ---- Pagination ----
	page := mustAtoi(c.DefaultQuery("page", "1"))
	page = int(math.Max(float64(page), 1))

	perPage := clampPerPage(mustAtoi(c.DefaultQuery("per_page", "15")))
	limit := perPage
	offset := (page - 1) * perPage

	// ---- Sorting ----
	sortParam := c.DefaultQuery("sort", "group_1")
	dirParam := c.DefaultQuery("dir", "ASC")
	orderKey := normalizeSortKey(sortParam)
	dir := normalizeDir(dirParam)

	// ---- View Mode ----
	viewParam := strings.ToLower(strings.TrimSpace(c.DefaultQuery("view", "list")))
	isGroupedView := viewParam == "group" || viewParam == "grouped" || viewParam == "category"

	// ---- Phase / Preferred Phase ----
	phaseParam := strings.TrimSpace(c.Query("phase"))
	preferredPhase := phaseParam
	if preferredPhase == "" {
		preferredPhase = "none"
	}

	// If ordering forces “no preferred phase”
	if orderKey == "group1_only" || orderKey == "relation_only" || orderKey == "group_rel_submitted" {
		preferredPhase = "none"
	}

	// ---- Filters ----
	assetNameKey := strings.TrimSpace(c.Query("name"))
	approvalStatuses := parseStatusParam(c, "approval_status")
	workStatuses := parseStatusParam(c, "work_status")

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
		limit,
		offset,
		assetNameKey,
		approvalStatuses,
		workStatuses,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// ---- Grouped View (Optional) ----
	var groups []repository.GroupedAssetBucket
	if isGroupedView {
		groups = repository.GroupAndSortByTopNode(
			assets,
			repository.SortDirection(strings.ToUpper(dir)),
		)
	}

	// ---- Response ----
	resp := gin.H{
		"assets":    assets,
		"total":     total,
		"page":      page,
		"per_page":  perPage,
		"sort":      sortParam,
		"dir":       strings.ToLower(dir),
		"project":   project,
		"root":      root,
		"has_next":  offset+limit < int(total),
		"has_prev":  page > 1,
		"page_last": (int(total) + perPage - 1) / perPage,
		"view":      viewParam,
	}

	if phaseParam != "" {
		resp["phase"] = phaseParam
	}
	if assetNameKey != "" {
		resp["name"] = assetNameKey
	}
	if len(approvalStatuses) > 0 {
		resp["approval_status"] = approvalStatuses
	}
	if len(workStatuses) > 0 {
		resp["work_status"] = workStatuses
	}
	if isGroupedView {
		resp["groups"] = groups
	}

	c.JSON(http.StatusOK, resp)
}

// ========================================================================
// Helpers
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
	// match your UI expectations
	if n <= 0 {
		return 15
	}
	if n > 200 {
		return 200
	}
	return n
}

func normalizeDir(s string) string {
	ss := strings.ToUpper(strings.TrimSpace(s))
	if ss == "DESC" {
		return "DESC"
	}
	return "ASC"
}

func normalizeSortKey(s string) string {
	ss := strings.ToLower(strings.TrimSpace(s))

	// You can expand these as you support more UI sorts
	switch ss {
	case "group_1", "group1":
		return "group_1"
	case "top_group_node", "top":
		return "top_group_node"
	case "relation":
		return "relation"
	case "submitted_at", "submitted":
		return "submitted_at"
	case "group1_only":
		return "group1_only"
	case "relation_only":
		return "relation_only"
	case "group_rel_submitted":
		return "group_rel_submitted"
	default:
		// safe default for stable pagination
		return "group_1"
	}
}

// parseStatusParam supports:
// ?approval_status=check,review
// ?approval_status=check&approval_status=review
func parseStatusParam(c *gin.Context, key string) []string {
	raw := c.QueryArray(key)
	if len(raw) == 0 {
		v := strings.TrimSpace(c.Query(key))
		if v == "" {
			return nil
		}
		parts := strings.Split(v, ",")
		out := make([]string, 0, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" {
				out = append(out, p)
			}
		}
		if len(out) == 0 {
			return nil
		}
		return out
	}

	out := make([]string, 0, len(raw))
	for _, v := range raw {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		// allow comma even in array form
		if strings.Contains(v, ",") {
			parts := strings.Split(v, ",")
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if p != "" {
					out = append(out, p)
				}
			}
			continue
		}
		out = append(out, v)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}
