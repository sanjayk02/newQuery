package delivery  Put this into delivery/reviewinfo.go (or replace your existing ListAssetsPivot there):

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/PolygonPictures/central30-web/front/usecase"
)

type ReviewInfo struct {
	uc *usecase.ReviewInfo
}

// splitCSV converts a comma-separated query param into []string.
func splitCSV(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

// ======================================================
// ListAssetsPivot – filtered, phase-aware asset review listing
// Route: GET /api/projects/:project/reviews/assets/pivot
// ======================================================
func (h *ReviewInfo) ListAssetsPivot(c *gin.Context) {
	project := c.Param("project")
	if project == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project is required"})
		return
	}

	// --- pagination ---
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "15"))
	if perPage <= 0 {
		perPage = 15
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * perPage

	// --- sorting & phase ---
	sortKey := c.DefaultQuery("sort", "group_1")
	dir := strings.ToLower(c.DefaultQuery("dir", "asc"))
	preferredPhase := strings.ToLower(c.DefaultQuery("phase", "none"))

	// --- filters ---
	nameKey := strings.TrimSpace(c.DefaultQuery("name", ""))
	apprStatuses := splitCSV(c.DefaultQuery("appr", ""))  // e.g. ?appr=check,dirReview
	workStatuses := splitCSV(c.DefaultQuery("work", ""))  // e.g. ?work=inProgress,svOther

	// --- call usecase ---
	list, total, err := h.uc.ListAssetsPivot(
		c.Request.Context(),
		project,
		"assets",       // root
		preferredPhase, // phase bias for sorting
		sortKey,
		dir,
		perPage,
		offset,
		nameKey,
		apprStatuses,
		workStatuses,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.PureJSON(http.StatusOK, gin.H{
		"assets":   list,
		"total":    total, // ✅ filtered total when filters active, else full total
		"page":     page,
		"per_page": perPage,
		"sort":     sortKey,
		"dir":      dir,
		"phase":    preferredPhase,
	})
}
