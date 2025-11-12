func splitCSV(v string) []string {
	if v == "" {
		return nil
	}
	raw := strings.Split(v, ",")
	out := make([]string, 0, len(raw))
	for _, s := range raw {
		if trimmed := strings.TrimSpace(s); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

// ============================================================
// ListAssetsPivot — filtered, phase-aware asset review listing
// Route: GET /api/projects/:project/reviews/assets/pivot
// ============================================================
func (h *Handler) ListAssetsPivot(c *gin.Context) {
	project := c.Param("project")
	if project == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project is required"})
		return
	}

	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "15"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	offset := (page - 1) * perPage

	sortKey := c.DefaultQuery("sort", "group_1")
	dir := strings.ToLower(c.DefaultQuery("dir", "asc"))
	preferredPhase := strings.ToLower(c.DefaultQuery("phase", "none"))

	nameKey := strings.TrimSpace(c.DefaultQuery("name", ""))
	apprStatuses := splitCSV(c.DefaultQuery("appr", ""))
	workStatuses := splitCSV(c.DefaultQuery("work", ""))

	list, total, err := h.repo.ReviewInfo.ListAssetsPivot(
		c.Request.Context(),
		project, "assets", preferredPhase,
		sortKey, dir,
		perPage, offset,
		nameKey, apprStatuses, workStatuses,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"assets": list,
		"total":  total,
	})
}
