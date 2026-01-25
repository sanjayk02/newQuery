func (u *ReviewInfo) ListAssetsPivot(ctx context.Context, p ListAssetsPivotParams) (*ListAssetsPivotResult, error) {
	if p.Project == "" {
		return nil, fmt.Errorf("project is required")
	}
	if p.Root == "" {
		p.Root = "assets"
	}
	if p.PerPage <= 0 {
		p.PerPage = 15
	}
	if p.Page <= 0 {
		p.Page = 1
	}

	limit := p.PerPage
	offset := (p.Page - 1) * p.PerPage

	// normalize dir
	dir := strings.ToUpper(strings.TrimSpace(p.Direction))
	if dir != "ASC" && dir != "DESC" {
		dir = "ASC"
	}

	isGroupedView := p.View == "group" || p.View == "grouped" || p.View == "category"

	// ---------- LIST VIEW ----------
	if !isGroupedView {
		assets, total, err := u.repo.ListAssetsPivot(
			ctx,
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
			return nil, err
		}

		pageLast := int((total + int64(p.PerPage) - 1) / int64(p.PerPage))

		return &ListAssetsPivotResult{
			Assets:   assets,
			Groups:   nil,
			Total:    total,
			Page:     p.Page,
			PerPage:  p.PerPage,
			PageLast: pageLast,
			HasNext:  offset+limit < int(total),
			HasPrev:  p.Page > 1,
			Sort:     p.OrderKey,
			Dir:      strings.ToLower(dir),
		}, nil
	}

	// ---------- GROUPED VIEW (DB PAGINATED) ----------
	assetsPage, total, err := u.repo.ListAssetsPivot(
		ctx,
		p.Project,
		p.Root,
		p.PreferredPhase,
		"group_1",
		strings.ToLower(dir),
		limit,
		offset,
		p.AssetNameKey,
		p.ApprovalStatuses,
		p.WorkStatuses,
	)
	if err != nil {
		return nil, err
	}

	groupedPage := repository.GroupAndSortByTopNode(
		assetsPage,
		repository.SortDirection(dir),
	)

	pageLast := int((total + int64(p.PerPage) - 1) / int64(p.PerPage))

	return &ListAssetsPivotResult{
		Assets:   assetsPage,
		Groups:   groupedPage,
		Total:    total,
		Page:     p.Page,
		PerPage:  p.PerPage,
		PageLast: pageLast,
		HasNext:  offset+limit < int(total),
		HasPrev:  p.Page > 1,
		Sort:     "group_1",
		Dir:      strings.ToLower(dir),
	}, nil
}
