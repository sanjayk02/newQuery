package api

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

	// ✅ Change this to your real module path
	"your/module/repository"
)

// -------------------------------------------------------
// DEFAULTS & ALLOWED VALUES
// -------------------------------------------------------

var defaultRoot = "assets"
var defaultPerPage = 60

var allowedPhases = map[string]struct{}{
	"mdl":  {},
	"rig":  {},
	"bld":  {},
	"dsn":  {},
	"ldv":  {},
	"none": {},
}

// -------------------------------------------------------
// INT PARSING HELPERS
// -------------------------------------------------------

func mustAtoi(s string) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return n
}

func clampPerPage(n int) int {
	if n <= 0 {
		return defaultPerPage
	}
	if n > 200 {
		return 200
	}
	return n
}

// -------------------------------------------------------
// SORT NORMALIZATION
// -------------------------------------------------------

func normalizeDir(dir string) string {
	switch strings.ToUpper(strings.TrimSpace(dir)) {
	case "DESC":
		return "DESC"
	default:
		return "ASC"
	}
}

// Maps frontend sort keys → backend order keys
func normalizeSortKey(key string) string {
	key = strings.TrimSpace(strings.ToLower(key))

	switch key {
	case "group_1", "group1", "name":
		return "group1_only"

	case "relation":
		return "relation_only"

	case "group_rel":
		return "group_rel_submitted"

	case "submitted", "submitted_at", "submitted_at_utc":
		return "submitted_at_utc"

	case "mdl_work":
		return "mdl_work"
	case "rig_work":
		return "rig_work"
	case "bld_work":
		return "bld_work"
	case "dsn_work":
		return "dsn_work"
	case "ldv_work":
		return "ldv_work"

	case "mdl_appr":
		return "mdl_appr"
	case "rig_appr":
		return "rig_appr"
	case "bld_appr":
		return "bld_appr"
	case "dsn_appr":
		return "dsn_appr"
	case "ldv_appr":
		return "ldv_appr"

	case "mdl_submitted":
		return "mdl_submitted"
	case "rig_submitted":
		return "rig_submitted"
	case "bld_submitted":
		return "bld_submitted"
	case "dsn_submitted":
		return "dsn_submitted"
	case "ldv_submitted":
		return "ldv_submitted"

	default:
		return "group1_only"
	}
}

// -------------------------------------------------------
// FILTER PARSING
// -------------------------------------------------------

func parseStatusParam(c *gin.Context, key string) []string {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return nil
	}

	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))

	for _, p := range parts {
		p = strings.ToLower(strings.TrimSpace(p))
		if p != "" {
			out = append(out, p)
		}
	}

	if len(out) == 0 {
		return nil
	}

	return out
}

// -------------------------------------------------------
// PAGINATION LINK HEADER (RFC 5988)
// -------------------------------------------------------

func paginationLinks(baseURL string, page, perPage, total int) string {
	if total <= 0 {
		return ""
	}

	lastPage := int(math.Ceil(float64(total) / float64(perPage)))
	if lastPage < 1 {
		lastPage = 1
	}

	var links []string

	if page > 1 {
		links = append(links,
			fmt.Sprintf(`<%s?page=1&per_page=%d>; rel="first"`, baseURL, perPage),
			fmt.Sprintf(`<%s?page=%d&per_page=%d>; rel="prev"`, baseURL, page-1, perPage),
		)
	}

	if page < lastPage {
		links = append(links,
			fmt.Sprintf(`<%s?page=%d&per_page=%d>; rel="next"`, baseURL, page+1, perPage),
			fmt.Sprintf(`<%s?page=%d&per_page=%d>; rel="last"`, baseURL, lastPage, perPage),
		)
	}

	return strings.Join(links, ", ")
}

// -------------------------------------------------------
// ✅ FINAL ROUTE — DIRECT apiRouter
// -------------------------------------------------------

func AttachAssetPivotRoute(apiRouter *gin.Engine, reviewInfoRepository *repository.ReviewInfo) {

	apiRouter.GET("/projects/:project/reviews/assets/pivot", func(c *gin.Context) {

		project := strings.TrimSpace(c.Param("project"))
		if project == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "project is required in the path"})
			return
		}

		root := c.DefaultQuery("root", defaultRoot)

		// ---- Phase Validation ----
		phaseParam := strings.TrimSpace(c.Query("phase"))
		if phaseParam != "" {
			lp := strings.ToLower(phaseParam)
			if lp != "none" {
				if _, ok := allowedPhases[lp]; !ok {
					c.JSON(http.StatusBadRequest, gin.H{
						"error":          "invalid phase",
						"allowed_phases": []string{"mdl", "rig", "bld", "dsn", "ldv", "none"},
					})
					return
				}
			}
		}

		// ---- Pagination ----
		page := mustAtoi(c.DefaultQuery("page", "1"))
		page = int(math.Max(float64(page), 1))
		perPage := clampPerPage(mustAtoi(c.DefaultQuery("per_page", fmt.Sprint(defaultPerPage))))
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

		// ---- Filters ----
		assetNameKey := strings.TrimSpace(c.Query("name"))
		approvalStatuses := parseStatusParam(c, "approval_status")
		workStatuses := parseStatusParam(c, "work_status")

		// ---- Preferred Phase Logic ----
		preferredPhase := phaseParam
		if orderKey == "group1_only" || orderKey == "relation_only" || orderKey == "group_rel_submitted" {
			preferredPhase = "none"
		}
		if preferredPhase == "" {
			preferredPhase = "none"
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 7*time.Second)
		defer cancel()

		assets, total, err := reviewInfoRepository.ListAssetsPivot(
			ctx,
			project, root,
			preferredPhase,
			orderKey,
			dir,
			limit, offset,
			assetNameKey,
			approvalStatuses,
			workStatuses,
		)
		if err != nil {
			log.Printf("[pivot-submissions] query error for project %q: %v", project, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
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

		// ---- Headers ----
		c.Header("Cache-Control", "public, max-age=15")
		baseURL := fmt.Sprintf("/api/projects/%s/reviews/assets/pivot", project)
		if links := paginationLinks(baseURL, page, perPage, int(total)); links != "" {
			c.Header("Link", links)
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

		c.IndentedJSON(http.StatusOK, resp)
	})
}
