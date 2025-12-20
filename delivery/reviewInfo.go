// ========================================================================
// ========= Asset Review Pivot Listing ===================================
// ========================================================================
//
// GET /api/projects/:project/reviews/assets/pivot
// Query:
//   root=assets
//   view=list|grouped
//   sort=group_1|...
//   dir=asc|desc
//   page=1
//   per_page=15
//   phase=none|mdl|rig|...
//   name=cam
//   approval_status=check,approved
//   work_status=check,review
//
func (h *ReviewInfo) ListAssetsPivot(c *gin.Context) {
	// ---- Required path param ----
	project := strings.TrimSpace(c.Param("project"))
	if project == "" {
		badRequest(c, fmt.Errorf("project is required"))
		return
	}

	// ---- Query params ----
	root := strings.TrimSpace(c.DefaultQuery("root", "assets"))
	if root == "" {
		root = "assets"
	}

	view := strings.TrimSpace(c.DefaultQuery("view", "list")) // "list" or "grouped"

	sortKey := strings.TrimSpace(c.DefaultQuery("sort", "group_1"))
	dir := strings.TrimSpace(c.DefaultQuery("dir", "asc")) // usecase will normalize if needed

	phase := strings.TrimSpace(c.DefaultQuery("phase", "none"))
	if phase == "" {
		phase = "none"
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}

	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "15"))
	if perPage < 1 {
		perPage = 15
	}

	assetNameKey := strings.TrimSpace(c.DefaultQuery("name", ""))

	// Support both new & old query keys (safe)
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

	// ---- Context timeout ----
	ctx, cancel := context.WithTimeout(c.Request.Context(), 7*time.Second)
	defer cancel()

	// ---- Call usecase (NEW SIGNATURE: (ctx, params) -> (result, error)) ----
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
	if err != nil {
		internalServerError(c, err)
		return
	}

	// ---- Response ----
	// Always return assets; return groups only when grouped view.
	res := gin.H{
		"assets":    result.Assets,
		"total":     result.Total,
		"page":      result.Page,
		"per_page":  result.PerPage,
		"page_last": result.PageLast,
		"has_next":  result.HasNext,
		"has_prev":  result.HasPrev,
		"sort":      result.Sort,
		"dir":       result.Dir,
		"project":   project,
		"root":      root,
		"view":      view,
	}
	if len(result.Groups) > 0 {
		res["groups"] = result.Groups
	}

	c.PureJSON(http.StatusOK, res)
}
