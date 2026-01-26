package delivery

/* ──────────────────────────────────────────────────────────────────────────
	Module Name:
    	delivery/reviewInfo.go

	Module Description:
		HTTP delivery handlers for review information management.

	Details:

	Update and Modification History:
		* - 29-10-2025 - SanjayK PSI - Initial creation sorting pagination implementation.
		* - 07-11-2025 - SanjayK PSI - Column visibility toggling implementation.
		* - 20-11-2025 - SanjayK PSI - Fixed typo in filter property names handling.
		* - [TODAY] - Added performance optimizations for ListAssetsPivot

	Functions:
		* NewReviewInfo: Creates a new ReviewInfo handler.
		* (ReviewInfo) List: Handles listing review information with filtering and pagination.
		* (ReviewInfo) Get: Handles retrieving a specific review information by ID.
		* (ReviewInfo) Post: Handles creating new review information.
		* (ReviewInfo) Update: Handles updating existing review information.
		* (ReviewInfo) Delete: Handles deleting review information by ID.
		* (ReviewInfo) ListAssets: Handles listing assets with filtering and pagination.
		* (ReviewInfo) ListAssetReviewInfos: Handles listing review information for a specific asset.
		* (ReviewInfo) ListShotReviewInfos: Handles listing review information for specific shots.
		* (splitCSV) – utility function: Splits a comma-separated string into a slice of trimmed strings.
		* (ReviewInfo) ListAssetsPivot: Handles listing pivoted assets with filtering and sorting.
	────────────────────────────────────────────────────────────────────────── */

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/PolygonPictures/central30-web/front/entity"
	"github.com/PolygonPictures/central30-web/front/libs"
	"github.com/PolygonPictures/central30-web/front/usecase"
	"github.com/gin-gonic/gin"
)

// Global circuit breaker state for pivot endpoint
var (
	pivotRequestCount int64
	pivotTimeoutCount int64
	circuitOpenUntil  time.Time
	circuitMutex      sync.RWMutex
)

type listReviewInfoParams struct {
	Studio        *string    `form:"studio"`
	TaskID        *string    `form:"task_id"`
	SubtaskID     *string    `form:"subtask_id"`
	Root          *string    `form:"root"`
	Group         *string    `form:"groups"`
	Relation      *string    `form:"relation"`
	Phase         *string    `form:"phase"`
	Component     *string    `form:"component"`
	Take          *string    `form:"take"`
	PerPage       *int       `form:"per_page"`
	Page          *int       `form:"page"`
	ModifiedSince *time.Time `form:"modified_since"`
}

func (p *listReviewInfoParams) Entity(project string) *entity.ListReviewInfoParams {
	var group []string
	if p.Group != nil {
		group = strings.Split(*p.Group, "/")
	}
	var relation []string
	if p.Relation != nil {
		relation = strings.Split(*p.Relation, ",")
	}
	var phase []string
	if p.Phase != nil {
		phase = strings.Split(*p.Phase, ",")
	}
	params := &entity.ListReviewInfoParams{
		Project:   project,
		Studio:    p.Studio,
		TaskID:    p.TaskID,
		SubtaskID: p.SubtaskID,
		Root:      p.Root,
		Group:     group,
		Relation:  relation,
		Phase:     phase,
		Component: p.Component,
		Take:      p.Take,
		BaseListParams: &entity.BaseListParams{
			PerPage: p.PerPage,
			Page:    p.Page,
		},
	}
	if p.ModifiedSince != nil {
		params.ModifiedSince = p.ModifiedSince
	}

	return params
}

type createReviewInfoParams struct {
	TaskID                    string              `json:"task_id"`
	SubtaskID                 string              `json:"subtask_id"`
	Studio                    string              `json:"studio"`
	ProjectPath               string              `json:"project_path"`
	ReviewComments            []*libs.CommentInfo `json:"review_comments"`
	Path                      *string             `json:"path"`
	TakePath                  string              `json:"take_path" binding:"required_without=Path"`
	Root                      string              `json:"root"`
	Groups                    []string            `json:"groups"`
	Relation                  string              `json:"relation"`
	Phase                     string              `json:"phase"`
	Component                 string              `json:"component"`
	Take                      string              `json:"take"`
	ApprovalStatus            string              `json:"approval_status"`
	ApprovalStatusUpdatedUser string              `json:"approval_status_updated_user"`
	WorkStatus                string              `json:"work_status"`
	WorkStatusUpdatedUser     string              `json:"work_status_updated_user"`
	ReviewTarget              []*libs.Content     `json:"review_target"`
	ReviewData                []*libs.Content     `json:"review_data"`
	OutputContents            []*libs.Content     `json:"output_contents"`
	SubmittedAtUtc            time.Time           `json:"submitted_at_utc"`
	SubmittedComputer         string              `json:"submitted_computer"`
	SubmittedOS               string              `json:"submitted_os"`
	SubmittedOSVersion        string              `json:"submitted_os_version"`
	SubmittedUser             string              `json:"submitted_user"`
	ExecutedAtUtc             time.Time           `json:"executed_at_utc"`
	ExecutedComputer          string              `json:"executed_computer"`
	ExecutedOS                string              `json:"executed_os"`
	ExecutedOSVersion         string              `json:"executed_os_version"`
	ExecutedUser              string              `json:"executed_user"`
	AllFiles                  []*libs.File        `json:"all_files"`
	NumAllFiles               uint32              `json:"num_all_files"`
	SizeAllFiles              uint64              `json:"size_all_files"`
	TargetComponents          []string            `json:"target_components"`

	Duration                    *int32  `json:"duration,omitempty"`
	DurationTimeline            *string `json:"duration_timeline,omitempty"`
	ExportShotsVersions         *bool   `json:"export_shotsVersions,omitempty"`
	ExportShotsVersionsRevision *string `json:"export_shotsVersions_revision,omitempty"`
	ExportShotsVersionsPath     *string `json:"export_shotsVersions_path,omitempty"`
}

func (p *createReviewInfoParams) Entity(
	project string,
	createdBy *string,
) *entity.CreateReviewInfoParams {
	takePath := p.TakePath
	if takePath == "" && p.Path != nil {
		takePath = *p.Path
	}
	return &entity.CreateReviewInfoParams{
		Project:   project,
		CreatedBy: createdBy,

		TaskID:                    p.TaskID,
		SubtaskID:                 p.SubtaskID,
		Studio:                    p.Studio,
		ProjectPath:               p.ProjectPath,
		ReviewComments:            p.ReviewComments,
		TakePath:                  takePath,
		Root:                      p.Root,
		Groups:                    p.Groups,
		Relation:                  p.Relation,
		Phase:                     p.Phase,
		Component:                 p.Component,
		Take:                      p.Take,
		ApprovalStatus:            p.ApprovalStatus,
		ApprovalStatusUpdatedUser: p.ApprovalStatusUpdatedUser,
		WorkStatus:                p.WorkStatus,
		WorkStatusUpdatedUser:     p.WorkStatusUpdatedUser,
		ReviewTarget:              p.ReviewTarget,
		ReviewData:                p.ReviewData,
		OutputContents:            p.OutputContents,
		SubmittedAtUtc:            p.SubmittedAtUtc,
		SubmittedComputer:         p.SubmittedComputer,
		SubmittedOS:               p.SubmittedOS,
		SubmittedOSVersion:        p.SubmittedOSVersion,
		SubmittedUser:             p.SubmittedUser,
		ExecutedAtUtc:             p.ExecutedAtUtc,
		ExecutedComputer:          p.ExecutedComputer,
		ExecutedOS:                p.ExecutedOS,
		ExecutedOSVersion:         p.ExecutedOSVersion,
		ExecutedUser:              p.ExecutedUser,
		AllFiles:                  p.AllFiles,
		NumAllFiles:               p.NumAllFiles,
		SizeAllFiles:              p.SizeAllFiles,
		TargetComponents:          p.TargetComponents,

		Duration:                    p.Duration,
		DurationTimeline:            p.DurationTimeline,
		ExportShotsVersions:         p.ExportShotsVersions,
		ExportShotsVersionsRevision: p.ExportShotsVersionsRevision,
		ExportShotsVersionsPath:     p.ExportShotsVersionsPath,
	}
}

type updateReviewInfoParams struct {
	ApprovalStatus            *string `json:"approval_status,omitempty"`
	ApprovalStatusUpdatedUser *string `json:"approval_status_updated_user,omitempty"`
	WorkStatus                *string `json:"work_status,omitempty"`
	WorkStatusUpdatedUser     *string `json:"work_status_updated_user,omitempty"`
}

func (p *updateReviewInfoParams) Entity(
	project string,
	id int32,
	modifiedBy *string,
) *entity.UpdateReviewInfoParams {
	return &entity.UpdateReviewInfoParams{
		ApprovalStatus:            p.ApprovalStatus,
		ApprovalStatusUpdatedUser: p.ApprovalStatusUpdatedUser,
		WorkStatus:                p.WorkStatus,
		WorkStatusUpdatedUser:     p.WorkStatusUpdatedUser,
		Project:                   project,
		ID:                        id,
		ModifiedBy:                modifiedBy,
	}
}

func NewReviewInfo(
	uc *usecase.ReviewInfo,
) *ReviewInfo {
	return &ReviewInfo{
		uc: uc,
	}
}

type ReviewInfo struct {
	uc *usecase.ReviewInfo
}

func (h *ReviewInfo) List(c *gin.Context) {
	var p listReviewInfoParams
	if err := c.ShouldBindQuery(&p); err != nil {
		badRequest(c, err)
		return
	}
	params := p.Entity(c.Param("project"))
	entities, total, err := h.uc.List(c.Request.Context(), params)
	if err != nil {
		internalServerError(c, err)
		return
	}

	res := libs.CreateListResponse("reviews", entities, c.Request, params, total)
	c.PureJSON(http.StatusOK, res)
}

func (h *ReviewInfo) Get(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		badRequest(c, err)
		return
	}
	params := &entity.GetReviewParams{
		Project: c.Param("project"),
		ID:      int32(id),
	}
	e, err := h.uc.Get(c.Request.Context(), params)
	if err != nil {
		if errors.Is(err, entity.ErrRecordNotFound) {
			badRequest(c, fmt.Errorf("review info with ID %d not found", params.ID))
			return
		}
		internalServerError(c, err)
		return
	}
	c.PureJSON(http.StatusOK, e)
}

func (h *ReviewInfo) Post(c *gin.Context) {
	var p createReviewInfoParams
	if err := c.ShouldBind(&p); err != nil {
		badRequest(c, err)
		return
	}
	params := p.Entity(c.Param("project"), nil)
	e, err := h.uc.Create(c.Request.Context(), params)
	if err != nil {
		internalServerError(c, err)
		return
	}
	c.PureJSON(http.StatusOK, e)
}

func (h *ReviewInfo) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		badRequest(c, err)
		return
	}
	var p updateReviewInfoParams
	if err := c.ShouldBind(&p); err != nil {
		badRequest(c, err)
		return
	}
	params := p.Entity(c.Param("project"), int32(id), nil)
	e, err := h.uc.Update(c.Request.Context(), params)
	if err != nil {
		if errors.Is(err, entity.ErrRecordNotFound) {
			badRequest(c, fmt.Errorf("review info with ID %d not found", params.ID))
			return
		}
		internalServerError(c, err)
		return
	}
	c.PureJSON(http.StatusOK, e)
}

func (h *ReviewInfo) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		badRequest(c, err)
		return
	}
	params := &entity.DeleteReviewInfoParams{
		Project:    c.Param("project"),
		ID:         int32(id),
		ModifiedBy: nil,
	}
	if err := h.uc.Delete(c.Request.Context(), params); err != nil {
		if errors.Is(err, entity.ErrRecordNotFound) {
			badRequest(c, fmt.Errorf("review info with ID %d not found", params.ID))
			return
		}
		internalServerError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

type assetListParams struct {
	Studio  *string `form:"studio"`
	PerPage *int    `form:"per_page"`
	Page    *int    `form:"page"`
}

func (p *assetListParams) Entity(project string) *entity.AssetListParams {
	params := &entity.AssetListParams{
		Project: project,
		Studio:  p.Studio,
		BaseListParams: &entity.BaseListParams{
			PerPage: p.PerPage,
			Page:    p.Page,
		},
	}

	return params
}

func (h *ReviewInfo) ListAssets(c *gin.Context) {
	var p assetListParams
	if err := c.ShouldBindQuery(&p); err != nil {
		badRequest(c, err)
		return
	}
	params := p.Entity(c.Param("project"))
	entities, total, err := h.uc.ListAssets(c.Request.Context(), params)
	if err != nil {
		internalServerError(c, err)
		return
	}

	res := libs.CreateListResponse("assets", entities, c.Request, params, total)
	c.PureJSON(http.StatusOK, res)
}

func (p *listReviewInfoParams) assetReviewInfoEntity(
	project string,
	asset string,
	relation string,
) *entity.AssetReviewInfoListParams {
	params := &entity.AssetReviewInfoListParams{
		Project:  project,
		Asset:    asset,
		Relation: relation,
	}

	return params
}

func (h *ReviewInfo) ListAssetReviewInfos(c *gin.Context) {
	var p listReviewInfoParams
	if err := c.ShouldBindQuery(&p); err != nil {
		badRequest(c, err)
		return
	}

	params := p.assetReviewInfoEntity(
		c.Param("project"),
		c.Param("asset"),
		c.Param("relation"),
	)
	entities, err := h.uc.ListAssetReviewInfos(c.Request.Context(), params)
	if err != nil {
		internalServerError(c, err)
		return
	}

	res := map[string]interface{}{
		"reviews": entities,
	}
	c.PureJSON(http.StatusOK, res)
}

func (p *listReviewInfoParams) shotReviewInfoEntity(
	project string,
	group string,
	relation string,
) *entity.ShotReviewInfoListParams {
	var groups []string
	if group != "" {
		groups = strings.Split(group, "/")
	}
	params := &entity.ShotReviewInfoListParams{
		Project:  project,
		Groups:   groups,
		Relation: relation,
	}

	return params
}

func (h *ReviewInfo) ListShotReviewInfos(c *gin.Context) {
	var p listReviewInfoParams
	if err := c.ShouldBindQuery(&p); err != nil {
		badRequest(c, err)
		return
	}

	params := p.shotReviewInfoEntity(
		c.Param("project"),
		c.Query("groups"),
		c.Query("relation"),
	)
	entities, err := h.uc.ListShotReviewInfos(c.Request.Context(), params)
	if err != nil {
		internalServerError(c, err)
		return
	}

	res := map[string]interface{}{
		"reviews": entities,
	}
	c.PureJSON(http.StatusOK, res)
}

/*
* ========================================================================================
  - splitCSV – utility function
  - Splits a comma-separated string into a slice of trimmed strings.
  - Ignores empty entries.

==========================================================================================
*/
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

/*
========================================================================================
  - ListAssetsPivot – handler function
  - Handles HTTP requests to list pivoted assets with filtering, sorting, and pagination.
  - Extracts parameters from the request, invokes the usecase, and returns the results as JSON.

========================================================================================
*/
func (h *ReviewInfo) ListAssetsPivot(c *gin.Context) {
	// ---- DEBUG: Log the exact request ----
	startTime := time.Now()
	requestID := fmt.Sprintf("%d", startTime.UnixNano())

	log.Printf("[API] 🚀 ListAssetsPivot START - ID: %s, Path: %s, Query: %s",
		requestID,
		c.Request.URL.Path,
		c.Request.URL.RawQuery)

	defer func() {
		elapsed := time.Since(startTime)
		log.Printf("[API] ✅ ListAssetsPivot END - ID: %s, Time: %v", requestID, elapsed)
	}()

	// ---- CIRCUIT BREAKER CHECK ----
	circuitMutex.RLock()
	if time.Now().Before(circuitOpenUntil) {
		circuitMutex.RUnlock()
		log.Printf("[CIRCUIT] ⚡ Circuit OPEN - rejecting request")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":       "Service Temporarily Unavailable",
			"message":     "Asset pivot service is experiencing high load. Please try again in 30 seconds.",
			"retry_after": 30,
			"request_id":  requestID,
		})
		return
	}
	circuitMutex.RUnlock()

	// Track request
	atomic.AddInt64(&pivotRequestCount, 1)

	// ---- Required path param ----
	project := strings.TrimSpace(c.Param("project"))
	if project == "" {
		badRequest(c, fmt.Errorf("project is required"))
		return
	}

	// ---- SPECIAL HANDLING FOR PROBLEMATIC PROJECTS ----
	if project == "rod" {
		log.Printf("[SPECIAL] Handling project 'rod' with optimizations")
	}

	// ---- Query params ----
	root := strings.TrimSpace(c.DefaultQuery("root", "assets"))
	if root == "" {
		root = "assets"
	}

	view := strings.TrimSpace(c.DefaultQuery("view", "list")) // list | grouped

	sortKey := strings.TrimSpace(c.DefaultQuery("sort", "group_1"))
	dir := strings.TrimSpace(c.DefaultQuery("dir", "asc")) // usecase will normalize

	phase := strings.TrimSpace(c.DefaultQuery("phase", "none"))
	if phase == "" {
		phase = "none"
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}

	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "30"))
	if perPage < 1 {
		perPage = 30
	}

	// ---- ENFORCE MAXIMUM LIMITS ----
	// Error shows: per_page=158 - THIS IS TOO HIGH!
	if perPage > 100 {
		// Force it to 50 for safety
		log.Printf("[WARN] Forced per_page from %d down to 50", perPage)
		perPage = 50
	}

	// Grouped view is MUCH slower - force smaller pages
	if view == "grouped" && perPage > 50 {
		log.Printf("[WARN] Grouped view: forced per_page from %d to 30", perPage)
		perPage = 30 // Even smaller for grouped view
	}

	// Deep pagination is slow
	if page > 10 {
		log.Printf("[WARN] Deep pagination detected: page=%d", page)
	}

	// Force per_page=30 for known problematic project 'rod'
	if project == "rod" && perPage > 30 {
		log.Printf("[SPECIAL] Project 'rod': forced per_page from %d to 30", perPage)
		perPage = 30
	}

	assetNameKey := strings.TrimSpace(c.DefaultQuery("name", ""))

	// Support both new & old query keys
	approvalRaw := c.Query("approval_status")
	if approvalRaw == "" {
		approvalRaw = c.Query("appr")
	}
	workRaw := c.Query("work_status")
	if workRaw == "" {
		workRaw = c.Query("work")
	}

	approvalStatuses := splitCSV(approvalRaw)
	workStatuses := splitCSV(workRaw)

	// ---- SHORTENED TIMEOUT ----
	// Current: 30 seconds is too long, client will timeout anyway
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second) // Changed from 30s to 10s
	defer cancel()

	// ---- ADD PERFORMANCE TRACKING ----
	queryStart := time.Now()

	params := usecase.ListAssetsPivotParams{
		Project:          project,
		Root:             root,
		PreferredPhase:   phase,
		OrderKey:         sortKey,
		Direction:        dir,
		Page:             page,
		PerPage:          perPage,
		AssetNameKey:     assetNameKey,
		ApprovalStatuses: approvalStatuses,
		WorkStatuses:     workStatuses,
		View:             view,
	}

	result, err := h.uc.ListAssetsPivot(ctx, params)

	queryTime := time.Since(queryStart)
	log.Printf("[PERF] Usecase call took: %v", queryTime)

	if err != nil {
		// ---- SPECIFIC TIMEOUT HANDLING ----
		if errors.Is(err, context.DeadlineExceeded) {
			timeouts := atomic.AddInt64(&pivotTimeoutCount, 1)
			log.Printf("[ERROR] ⏱️ TIMEOUT for project %s - Query took >10s (Total timeouts: %d)",
				project, timeouts)

			// If we get 3 timeouts in quick succession, open circuit
			if timeouts >= 3 {
				circuitMutex.Lock()
				circuitOpenUntil = time.Now().Add(30 * time.Second)
				circuitMutex.Unlock()
				log.Printf("[CIRCUIT] 🔥 Opening circuit - too many timeouts (%d)", timeouts)
			}

			// Return user-friendly timeout error
			c.JSON(http.StatusRequestTimeout, gin.H{
				"error":   "Query Timeout",
				"message": fmt.Sprintf("The query took too long (>10s). Project: %s", project),
				"suggestions": []string{
					fmt.Sprintf("Reduce 'per_page' from %d to 30 or less", perPage),
					"Add asset name filter with 'name=...'",
					"Use 'view=list' instead of 'view=grouped'",
					fmt.Sprintf("Try 'page=1' (current: %d)", page),
				},
				"code":       "TIMEOUT",
				"request_id": requestID,
				"query_time": queryTime.Seconds(),
			})
			return
		}

		// Check for specific error messages from usecase
		if strings.Contains(err.Error(), "reduce page") || strings.Contains(err.Error(), "too complex") {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Query Too Complex",
				"message": "Please reduce the page size or use filters",
				"max_per_page": 100,
				"code":    "QUERY_TOO_COMPLEX",
			})
			return
		}

		// Any other error
		log.Printf("[ERROR] ListAssetsPivot failed: %v", err)
		internalServerError(c, err)
		return
	}

	// ---- SUCCESS RESPONSE ----

	// Add performance headers
	c.Header("X-Request-ID", requestID)
	c.Header("X-Query-Time", fmt.Sprintf("%.3f", queryTime.Seconds()))
	c.Header("X-Total-Count", strconv.FormatInt(result.Total, 10))
	c.Header("X-Page-Last", strconv.Itoa(result.PageLast))

	// Return minimal response for grouped view (less data)
	if view == "grouped" {
		res := gin.H{
			"groups":     result.Groups,
			"total":      result.Total,
			"page":       result.Page,
			"per_page":   result.PerPage,
			"page_last":  result.PageLast,
			"has_next":   result.HasNext,
			"has_prev":   result.HasPrev,
			"item_count": len(result.Assets),
			"request_id": requestID,
		}
		c.PureJSON(http.StatusOK, res)
		return
	}

	// Normal response for list view
	res := gin.H{
		"assets":      result.Assets,
		"total":       result.Total,
		"page":        result.Page,
		"per_page":    result.PerPage,
		"page_last":   result.PageLast,
		"has_next":    result.HasNext,
		"has_prev":    result.HasPrev,
		"sort":        result.Sort,
		"dir":         result.Dir,
		"project":     project,
		"root":        root,
		"view":        view,
		"request_id":  requestID,
		"query_time":  queryTime.Seconds(),
	}
	if len(result.Groups) > 0 {
		res["groups"] = result.Groups
	}

	c.PureJSON(http.StatusOK, res)
}

// Helper functions (assuming they exist in your codebase)
func badRequest(c *gin.Context, err error) {
	c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
}

func internalServerError(c *gin.Context, err error) {
	c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
}
