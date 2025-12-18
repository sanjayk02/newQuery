type ReviewInfoDelivery struct {
    UC *usecase.ReviewInfoUsecase
}

func (d *ReviewInfoDelivery) ListAssetsPivot(c *gin.Context) {
    // ... read query params exactly like you already do ...
    // (project, root, phaseParam, page, perPage, sortParam, dirParam, viewParam, filters, etc.)

    ctx, cancel := context.WithTimeout(c.Request.Context(), 7*time.Second)
    defer cancel()

    result, err := d.UC.ListAssetsPivot(ctx, usecase.ListAssetsPivotParams{
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
        View:             viewParam,
    })
    if err != nil {
        log.Printf("[pivot-submissions] usecase error for project %q: %v", project, err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
        return
    }

    // headers
    c.Header("Cache-Control", "public, max-age=15")
    baseURL := fmt.Sprintf("/api/projects/%s/reviews/assets/pivot", project)
    if links := paginationLinks(baseURL, result.Page, result.PerPage, int(result.Total)); links != "" {
        c.Header("Link", links)
    }

    // response
    resp := gin.H{
        "assets":    result.Assets,
        "total":     result.Total,
        "page":      result.Page,
        "per_page":  result.PerPage,
        "page_last": result.PageLast,
        "has_next":  result.HasNext,
        "has_prev":  result.HasPrev,
        "sort":      sortParam,
        "dir":       result.Dir,
        "project":   project,
        "root":      root,
        "view":      viewParam,
    }
    if len(result.Groups) > 0 {
        resp["groups"] = result.Groups
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

    c.IndentedJSON(http.StatusOK, resp)
}
