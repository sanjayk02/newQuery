func (d *ReviewInfoDelivery) ListAssetsPivot(c *gin.Context) {
    project := strings.TrimSpace(c.Param("project"))
    root := c.DefaultQuery("root", "assets")

    // pagination
    page := mustAtoi(c.DefaultQuery("page", "1"))
    perPage := clampPerPage(mustAtoi(c.DefaultQuery("per_page", "15")))
    limit := perPage
    offset := (page - 1) * perPage

    // sort
    sortParam := c.DefaultQuery("sort", "group_1")
    dirParam := c.DefaultQuery("dir", "ASC")
    orderKey := normalizeSortKey(sortParam)
    dir := normalizeDir(dirParam)

    // filters
    assetNameKey := strings.TrimSpace(c.Query("name"))
    approvalStatuses := parseStatusParam(c, "approval_status")
    workStatuses := parseStatusParam(c, "work_status")

    // phase
    preferredPhase := strings.TrimSpace(c.Query("phase"))
    if preferredPhase == "" {
        preferredPhase = "none"
    }

    ctx, cancel := context.WithTimeout(c.Request.Context(), 7*time.Second)
    defer cancel()

    assets, total, err := d.reviewInfoRepository.ListAssetsPivot(
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

    c.JSON(http.StatusOK, gin.H{
        "assets":   assets,
        "total":    total,
        "page":     page,
        "per_page": perPage,
        "sort":     sortParam,
        "dir":      strings.ToLower(dir),
    })
}
