// ... [all imports and setup code remains the same] ...

// In the Assets Pivot API handler - updated efficient version
router.GET("/api/projects/:project/reviews/assets/pivot", func(c *gin.Context) {
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

    ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
    defer cancel()

    // ---------------------------------------------------------------
    // SINGLE EFFICIENT QUERY CALL
    // ---------------------------------------------------------------
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

    // Prepare response
    response := gin.H{
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

    // Add optional fields
    if phaseParam != "" {
        response["phase"] = phaseParam
    }
    if assetNameKey != "" {
        response["name"] = assetNameKey
    }
    if len(approvalStatuses) > 0 {
        response["approval_status"] = approvalStatuses
    }
    if len(workStatuses) > 0 {
        response["work_status"] = workStatuses
    }

    // For grouped view, apply grouping to the already-paginated results
    if isGroupedView {
        dirUpper := strings.ToUpper(dir)
        if dirUpper != "ASC" && dirUpper != "DESC" {
            dirUpper = "ASC"
        }
        grouped := repository.GroupAndSortByTopNode(
            assets,
            repository.SortDirection(dirUpper),
        )
        response["groups"] = grouped
    }

    // ---- Headers ----
    c.Header("Cache-Control", "public, max-age=15")
    baseURL := fmt.Sprintf("/api/projects/%s/reviews/assets/pivot", project)
    if links := paginationLinks(baseURL, page, perPage, int(total)); links != "" {
        c.Header("Link", links)
    }

    c.IndentedJSON(http.StatusOK, response)
})

// ... [rest of main.go remains the same] ...
