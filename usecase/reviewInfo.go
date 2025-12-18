package usecase

import (
    "context"
    "fmt"
    "strings"

    "your/module/path/repository"
)

type ReviewInfoUsecase struct {
    ReviewInfoRepo *repository.ReviewInfo
}

/* ---------- Input / Output DTOs ---------- */

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
    Assets    []repository.AssetPivot              // flat slice for the page
    Groups    []repository.GroupedAssetBucket      // only filled for grouped view
    Total     int64                                // total matching assets (for all pages)
    Page      int
    PerPage   int
    PageLast  int
    HasNext   bool
    HasPrev   bool
    Sort      string
    Dir       string
}

/* ---------- Public usecase ---------- */

func (u *ReviewInfoUsecase) ListAssetsPivot(
    ctx context.Context,
    p ListAssetsPivotParams,
) (*ListAssetsPivotResult, error) {

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

    // ------------ CASE 1: LIST VIEW (simple, DB-driven pagination) ------------
    if !isGroupedView {
        assets, total, err := u.ReviewInfoRepo.ListAssetsPivot(
            ctx,
            p.Project,
            p.Root,
            p.PreferredPhase,
            p.OrderKey,
            dir,
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

    // ---------- CASE 2: GROUPED VIEW (group-first, then paginate) ----------

    // 1) Fetch *all* matching assets in a stable base order
    const allLimit = 1_000_000
    assetsAll, total, err := u.ReviewInfoRepo.ListAssetsPivot(
        ctx,
        p.Project,
        p.Root,
        p.PreferredPhase,
        "group1_only", // stable base: order by group_1
        "ASC",
        allLimit,
        0,
        p.AssetNameKey,
        p.ApprovalStatuses,
        p.WorkStatuses,
    )
    if err != nil {
        return nil, err
    }

    // 2) Group ALL assets
    groupedAll := repository.GroupAndSortByTopNode(
        assetsAll,
        repository.SortDirection(dir),
    )

    // 3) Flatten them in group order
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
            Sort:     "group1_only",
            Dir:      strings.ToLower(dir),
        }, nil
    }

    // 4) Page over the flat, grouped-ordered slice
    start := offset
    if start > totalAssets {
        start = totalAssets
    }
    end := start + limit
    if end > totalAssets {
        end = totalAssets
    }
    pageSlice := flat[start:end]

    // 5) Re-group only the page slice
    pageGroups := repository.GroupAndSortByTopNode(
        pageSlice,
        repository.SortDirection(dir),
    )

    pageLast := (totalAssets + p.PerPage - 1) / p.PerPage

    return &ListAssetsPivotResult{
        Assets:   pageSlice,
        Groups:   pageGroups,
        Total:    total, // total from DB (matching filters)
        Page:     p.Page,
        PerPage:  p.PerPage,
        PageLast: pageLast,
        HasNext:  offset+limit < totalAssets,
        HasPrev:  p.Page > 1,
        Sort:     "group1_only",
        Dir:      strings.ToLower(dir),
    }, nil
}
