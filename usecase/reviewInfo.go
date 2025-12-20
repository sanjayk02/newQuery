package usecase

import (
	"context"
	"fmt"
	"strings"

	"github.com/PolygonPictures/central30-web/front/repository"
)

type ListAssetsPivotParams struct {
	Project          string
	Root             string
	PreferredPhase   string
	OrderKey         string
	Direction        string
	Page             int
	PerPage          int
	AssetNameKey     string
	ApprovalStatuses []string
	WorkStatuses     []string
	View             string // "list" or "grouped"
}

type ListAssetsPivotResult struct {
	Assets   []repository.AssetPivot
	Groups   []repository.GroupedAssetBucket
	Total    int64
	Page     int
	PerPage  int
	PageLast int
	HasNext  bool
	HasPrev  bool
	Sort     string
	Dir      string
}

// Add this method on your existing usecase.ReviewInfo
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
		assets, total, err := u.reviewInfoRepo.ListAssetsPivot( // <-- rename field if needed
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

	// ---------- GROUPED VIEW (group-first order, then paginate) ----------
	const allLimit = 1_000_000
	assetsAll, total, err := u.reviewInfoRepo.ListAssetsPivot( // <-- rename field if needed
		ctx,
		p.Project,
		p.Root,
		p.PreferredPhase,
		"group_1",
		"asc",
		allLimit,
		0,
		p.AssetNameKey,
		p.ApprovalStatuses,
		p.WorkStatuses,
	)
	if err != nil {
		return nil, err
	}

	groupedAll := repository.GroupAndSortByTopNode(assetsAll, repository.SortDirection(dir))

	flat := make([]repository.AssetPivot, 0, len(assetsAll))
	for _, g := range groupedAll {
		flat = append(flat, g.Items...)
	}

	totalAssets := len(flat)
	if totalAssets == 0 {
		return &ListAssetsPivotResult{
			Assets:   []repository.AssetPivot{},
			Groups:   []repository.GroupedAssetBucket{},
			Total:    0,
			Page:     p.Page,
			PerPage:  p.PerPage,
			PageLast: 0,
			HasNext:  false,
			HasPrev:  false,
			Sort:     "group_1",
			Dir:      strings.ToLower(dir),
		}, nil
	}

	start := offset
	if start > totalAssets {
		start = totalAssets
	}
	end := start + limit
	if end > totalAssets {
		end = totalAssets
	}

	pageSlice := flat[start:end]
	pageGroups := repository.GroupAndSortByTopNode(pageSlice, repository.SortDirection(dir))

	pageLast := (totalAssets + p.PerPage - 1) / p.PerPage

	return &ListAssetsPivotResult{
		Assets:   pageSlice,
		Groups:   pageGroups,
		Total:    total,
		Page:     p.Page,
		PerPage:  p.PerPage,
		PageLast: pageLast,
		HasNext:  offset+limit < totalAssets,
		HasPrev:  p.Page > 1,
		Sort:     "group_1",
		Dir:      strings.ToLower(dir),
	}, nil
}
