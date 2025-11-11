// inside: GET /api/projects/:project/reviews/assets/pivot
phaseParam := strings.ToLower(strings.TrimSpace(c.DefaultQuery("phase", "")))

page := mustAtoi(c.DefaultQuery("page", "1"))
page = int(math.Max(float64(page), 1))
perPage := clampPerPage(mustAtoi(c.DefaultQuery("per_page", fmt.Sprint(defaultPerPage))))
limit := perPage
offset := (page - 1) * perPage

// Sorting
sortParam := c.DefaultQuery("sort", "group_1")
dirParam  := c.DefaultQuery("dir", "ASC")
orderKey  := normalizeSortKey(sortParam)
dir       := normalizeDir(dirParam)

// Filters
nameKey   := strings.ToLower(strings.TrimSpace(c.DefaultQuery("name", "")))
nameMode  := strings.ToLower(strings.TrimSpace(c.DefaultQuery("name_mode", "prefix"))) // "prefix" | "exact"
workRaw   := strings.TrimSpace(c.DefaultQuery("work", "")) // csv
apprRaw   := strings.TrimSpace(c.DefaultQuery("appr", "")) // csv
splitCSV := func(s string) []string {
	if s == "" { return nil }
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.ToLower(strings.TrimSpace(p))
		if p != "" { out = append(out, p) }
	}
	return out
}
workFilters := splitCSV(workRaw)
apprFilters := splitCSV(apprRaw)

// Phase preference
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
	ctx, project, root, preferredPhase, orderKey, dir, limit, offset,
	nameKey, nameMode, workFilters, apprFilters,
)
if err != nil {
	log.Printf("[pivot-submissions] query error for project %q: %v", project, err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
	return
}

// Response (unchanged) ...
