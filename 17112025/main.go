// parseStatusParam parses list-like query params such as "approval_status" and "work_status".
// It supports both repeated params (?approval_status=foo&approval_status=bar)
// and comma-separated (?approval_status=foo,bar).
func parseStatusParam(c *gin.Context, key string) []string {
	// Highest priority: repeated query params
	vals := c.QueryArray(key)

	// Fallback: single comma-separated value
	if len(vals) == 0 {
		raw := strings.TrimSpace(c.Query(key))
		if raw != "" {
			vals = strings.Split(raw, ",")
		}
	}

	out := make([]string, 0, len(vals))
	for _, v := range vals {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		// You can decide if "all" should mean "no filter"
		if strings.EqualFold(v, "all") {
			continue
		}
		out = append(out, v)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}


apiRouter.GET("/projects/:project/reviews/assets/pivot", func(c *gin.Context) {
	project := strings.TrimSpace(c.Param("project"))
	if project == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project is required in the path"})
		return
	}

	root := c.DefaultQuery("root", defaultRoot)

	// NO DEFAULT PHASE: read as-is; if empty, we won't echo it back.
	phaseParam := strings.TrimSpace(c.Query("phase")) // "" if not provided

	// If a phase is supplied, allow only known phases (plus "none")
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

	// Pagination
	page := mustAtoi(c.DefaultQuery("page", "1"))
	page = int(math.Max(float64(page), 1))
	perPage := clampPerPage(mustAtoi(c.DefaultQuery("per_page", fmt.Sprint(defaultPerPage))))
	limit := perPage
	offset := (page - 1) * perPage

	// Sorting
	sortParam := c.DefaultQuery("sort", "group_1")
	dirParam := c.DefaultQuery("dir", "ASC")
	orderKey := normalizeSortKey(sortParam)
	dir := normalizeDir(dirParam)

	// Filters
	assetNameKey := strings.TrimSpace(c.Query("name"))
	approvalStatuses := parseStatusParam(c, "approval_status")
	workStatuses := parseStatusParam(c, "work_status")

	// Internal preferredPhase we pass to repo:
	// - If sorting by group/relation buckets, force "none" (no phase bias).
	// - Else, use the provided phase if any, otherwise "none".
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
		preferredPhase, // phase bias
		orderKey,       // orderKey
		dir,            // direction
		limit, offset,
		assetNameKey,     // 🔎 name filter
		approvalStatuses, // 🔎 approval_status filter
		workStatuses,     // 🔎 work_status filter
	)
	if err != nil {
		log.Printf("[pivot-submissions] query error for project %q: %v", project, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	// Response
	c.Header("Cache-Control", "public, max-age=15")
	baseURL := fmt.Sprintf("/api/projects/%s/reviews/assets/pivot", project)
	if links := paginationLinks(baseURL, page, perPage, int(total)); links != "" {
		c.Header("Link", links)
	}

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
	}
	if phaseParam != "" {
		resp["phase"] = phaseParam
	}

	// Echo filters back so frontend can debug (optional)
	if assetNameKey != "" {
		resp["name"] = assetNameKey
	}
	if len(approvalStatuses) > 0 {
		resp["approval_status"] = approvalStatuses
	}
	if len(workStatuses) > 0 {
		resp["work_status"] = workStatuses
	}

	c.IndentedJSON(http.StatusOK, resp)
})
