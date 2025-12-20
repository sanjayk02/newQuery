package delivery

import (
	"context"
	"fmt"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"your/module/path/usecase"
)

type ReviewInfoDelivery struct {
	reviewInfoUsecase *usecase.ReviewInfoUsecase
}

func NewReviewInfoDelivery(u *usecase.ReviewInfoUsecase) *ReviewInfoDelivery {
	return &ReviewInfoDelivery{reviewInfoUsecase: u}
}

// Register like:
// apiRouter.GET("/projects/:project/reviews/assets/pivot", reviewInfoDelivery.ListAssetsPivot)
func (d *ReviewInfoDelivery) ListAssetsPivot(c *gin.Context) {
	// ---- Required path param ----
	project := strings.TrimSpace(c.Param("project"))
	if project == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project is required in the path"})
		return
	}

	// ---- Basic params ----
	root := strings.TrimSpace(c.DefaultQuery("root", "assets"))

	// ---- Phase ----
	phaseParam := strings.TrimSpace(c.Query("phase"))
	if phaseParam == "" {
		phaseParam = "none"
	}

	// ---- Pagination ----
	page := mustAtoi(c.DefaultQuery("page", "1"))
	page = int(math.Max(float64(page), 1))

	perPage := clampPerPage(mustAtoi(c.DefaultQuery("per_page", "15")))

	// ---- Sorting ----
	sortParam := strings.TrimSpace(c.DefaultQuery("sort", "group_1"))
	dirParam := strings.TrimSpace(c.DefaultQuery("dir", "ASC"))

	// Your usecase expects:
	// OrderKey -> string (your internal sort key)
	// Direction -> "ASC" or "DESC"
	orderKey := normalizeSortKey(sortParam)
	dir := normalizeDir(dirParam)

	// ---- View ----
	viewParam := strings.ToLower(strings.TrimSpace(c.DefaultQuery("view", "list")))

	// ---- Filters ----
	assetNameKey := strings.TrimSpace(c.Query("name"))
	approvalStatuses := parseStatusParam(c, "approval_status")
	workStatuses := parseStatusParam(c, "work_status")

	// ---- Preferred phase logic ----
	preferredPhase := phaseParam
	if orderKey == "group1_only" || orderKey == "relation_only" || orderKey == "group_rel_submitted" {
		preferredPhase = "none"
	}
	if preferredPhase == "" {
		preferredPhase = "none"
	}

	// ---- Context timeout ----
	ctx, cancel := context.WithTimeout(c.Request.Context(), 7*time.Second)
	defer cancel()

	// ---- Usecase call (CORRECT) ----
	params := usecase.ListAssetsPivotParams{
		Project:          project,
		Root:             root,
		PreferredPhase:   preferredPhase,
		OrderKey:         orderKey,
		Direction:        dir,
		Page:             page,
		PerPage:          perPage,
		AssetNameKey:     assetNameKey,
		ApprovalStatuses: approvalStatuses,
		WorkStatuses:     workStatuses,
		View:             viewParam, // "list" or "grouped"
	}

	result, err := d.reviewInfoUsecase.ListAssetsPivot(ctx, params)
	if err != nil {
		log.Printf("[pivot-assets] query error for project %q: %v", project, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// ---- Response ----
	resp := gin.H{
		"assets":    result.Assets,
		"total":     result.Total,
		"page":      result.Page,
		"per_page":  result.PerPage,
		"page_last": result.PageLast,
		"has_next":  result.HasNext,
		"has_prev":  result.HasPrev,
		"sort":      sortParam,
		"dir":       strings.ToLower(result.Dir),
		"project":   project,
		"root":      root,
		"view":      viewParam,
	}

	// include groups only for grouped view
	isGroupedView := viewParam == "group" || viewParam == "grouped" || viewParam == "category"
	if isGroupedView {
		resp["groups"] = result.Groups
	}

	// optional echoes
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

	// cache + link headers (optional)
	c.Header("Cache-Control", "public, max-age=15")
	baseURL := fmt.Sprintf("/api/projects/%s/reviews/assets/pivot", project)
	if links := paginationLinks(baseURL, page, perPage, int(result.Total)); links != "" {
		c.Header("Link", links)
	}

	c.JSON(http.StatusOK, resp)
}

// -----------------------------------------------------------------------------
// Helpers (same file, so delivery compiles cleanly)
// -----------------------------------------------------------------------------

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

func clampPerPage(v int) int {
	if v <= 0 {
		return 15
	}
	if v > 200 {
		return 200
	}
	return v
}

func normalizeDir(dir string) string {
	d := strings.ToUpper(strings.TrimSpace(dir))
	if d != "ASC" && d != "DESC" {
		return "ASC"
	}
	return d
}

// Map UI "sort" -> your backend orderKey
func normalizeSortKey(sort string) string {
	s := strings.ToLower(strings.TrimSpace(sort))
	switch s {
	case "group_1", "group1":
		return "group1_only"
	case "top_group_node":
		return "top_group_node"
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
	seen := map[string]bool{}
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if !seen[p] {
			seen[p] = true
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func paginationLinks(baseURL string, page, perPage, total int) string {
	if perPage <= 0 {
		return ""
	}
	last := (total + perPage - 1) / perPage
	if last <= 1 {
		return ""
	}

	makeURL := func(p int) string {
		return fmt.Sprintf("%s?page=%d&per_page=%d", baseURL, p, perPage)
	}

	links := []string{
		fmt.Sprintf(`<%s>; rel="first"`, makeURL(1)),
		fmt.Sprintf(`<%s>; rel="last"`, makeURL(last)),
	}

	if page > 1 {
		links = append(links, fmt.Sprintf(`<%s>; rel="prev"`, makeURL(page-1)))
	}
	if page < last {
		links = append(links, fmt.Sprintf(`<%s>; rel="next"`, makeURL(page+1)))
	}

	return strings.Join(links, ", ")
}
