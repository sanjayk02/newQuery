func (u *ReviewInfo) ListAssetsPivot(ctx context.Context, p ListAssetsPivotParams) (*ListAssetsPivotResult, error) {
    // Log start of operation
    log.Printf("[USECASE] ListAssetsPivot starting: project=%s, page=%d, per_page=%d, view=%s",
        p.Project, p.Page, p.PerPage, p.View)
    
    startTime := time.Now()
    defer func() {
        log.Printf("[USECASE] ListAssetsPivot completed in %v", time.Since(startTime))
    }()

    // Validate required parameters
    if p.Project == "" {
        return nil, fmt.Errorf("project is required")
    }
    
    // Set defaults with performance in mind
    if p.Root == "" {
        p.Root = "assets"
    }
    
    // ---- ENFORCE STRICT LIMITS FOR PERFORMANCE ----
    // From the error, we know per_page=158 was used - this is too high!
    if p.PerPage <= 0 {
        p.PerPage = 30  // Reduced from 15 for better user experience
    }
    
    // HARD LIMIT: Never allow more than 100 items per page
    if p.PerPage > 100 {
        return nil, fmt.Errorf("per_page cannot exceed 100 for performance reasons. Please use 100 or less")
    }
    
    // Grouped view is much slower - enforce smaller pages
    isGroupedView := p.View == "group" || p.View == "grouped" || p.View == "category"
    if isGroupedView && p.PerPage > 50 {
        log.Printf("[USECASE] Warning: grouped view with per_page=%d, forcing to 50", p.PerPage)
        p.PerPage = 50
    }
    
    // Deep pagination is expensive - warn but allow
    if p.Page <= 0 {
        p.Page = 1
    }
    if p.Page > 50 {
        log.Printf("[USECASE] Warning: deep pagination page=%d", p.Page)
    }
    
    // Normalize sort direction
    dir := strings.ToUpper(strings.TrimSpace(p.Direction))
    if dir != "ASC" && dir != "DESC" {
        dir = "ASC"
    }
    
    // Apply context timeout at usecase level too
    ucCtx, cancel := context.WithTimeout(ctx, 12*time.Second) // 2 seconds buffer from delivery timeout
    defer cancel()
    
    limit := p.PerPage
    offset := (p.Page - 1) * p.PerPage
    
    log.Printf("[USECASE] Calling repository: project=%s, limit=%d, offset=%d, view=%s",
        p.Project, limit, offset, p.View)
    
    // Call repository with timeout context
    assets, total, err := u.repo.ListAssetsPivot(
        ucCtx,
        p.Project,
        p.Root,
        p.PreferredPhase,
        p.OrderKey,
        strings.ToLower(dir),
        limit,
        offset,
        p.AssetNameKey,
        p.ApprovalStatuses,
        p.WorkStatuses,
    )
    
    if err != nil {
        // Check if it's a timeout
        if errors.Is(err, context.DeadlineExceeded) {
            return nil, fmt.Errorf("database query timeout. Try reducing page size or using filters")
        }
        
        // Check if it's a known performance issue
        if strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "deadline") {
            return nil, fmt.Errorf("query too slow. Please try: 1) Reduce per_page, 2) Use page=1, 3) Add name filter")
        }
        
        return nil, fmt.Errorf("ListAssetsPivot: %w", err)
    }
    
    // Handle empty results for deep pages
    if len(assets) == 0 && p.Page > 1 {
        log.Printf("[USECASE] No results for page %d, suggesting user try page 1", p.Page)
        // Don't auto-redirect, just return empty with current page
    }
    
    // Calculate pagination metadata
    pageLast := 1
    if total > 0 && p.PerPage > 0 {
        pageLast = int((total + int64(p.PerPage) - 1) / int64(p.PerPage))
    }
    
    // Ensure page doesn't exceed total pages
    if p.Page > pageLast && pageLast > 0 {
        p.Page = pageLast
        // Recalculate offset
        offset = (p.Page - 1) * p.PerPage
    }
    
    result := &ListAssetsPivotResult{
        Assets:   assets,
        Total:    total,
        Page:     p.Page,
        PerPage:  p.PerPage,
        PageLast: pageLast,
        HasNext:  offset+limit < int(total),
        HasPrev:  p.Page > 1,
        Sort:     p.OrderKey,
        Dir:      strings.ToLower(dir),
    }
    
    // Only perform grouping if it's a grouped view AND we have assets
    if isGroupedView && len(assets) > 0 {
        // Warn if grouping large datasets
        if len(assets) > 100 {
            log.Printf("[USECASE] Warning: grouping %d assets may be slow", len(assets))
        }
        
        groupingStart := time.Now()
        result.Groups = repository.GroupAndSortByTopNode(
            assets,
            repository.SortDirection(dir),
        )
        log.Printf("[USECASE] Grouping completed in %v", time.Since(groupingStart))
    }
    
    log.Printf("[USECASE] Success: %d assets, %d total, page %d/%d",
        len(assets), total, p.Page, pageLast)
    
    return result, nil
}
