func (d *ReviewInfo) ListShotsPivot(c *gin.Context) {
	project  := c.Param("project")
	orderKey := c.DefaultQuery("orderKey",  "group1_only")
	direction := c.DefaultQuery("direction", "ASC")
	phase    := c.DefaultQuery("phase",     "")
	nameKey  := c.DefaultQuery("nameKey",   "")

	page, _    := strconv.Atoi(c.DefaultQuery("page",    "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("perPage", "15"))

	approvalStatuses := c.QueryArray("approvalStatus")
	workStatuses     := c.QueryArray("workStatus")

	result, err := d.usecase.ListShotsPivot(
		c.Request.Context(),
		usecase.ListShotsPivotParams{
			Project:          project,
			PreferredPhase:   phase,
			OrderKey:         orderKey,
			Direction:        direction,
			Page:             page,
			PerPage:          perPage,
			ShotNameKey:      nameKey,
			ApprovalStatuses: approvalStatuses,
			WorkStatuses:     workStatuses,
		},
	)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items":    result.Shots,
		"total":    result.Total,
		"page":     result.Page,
		"perPage":  result.PerPage,
		"pageLast": result.PageLast,
		"hasNext":  result.HasNext,
		"hasPrev":  result.HasPrev,
		"sort":     result.Sort,
		"dir":      result.Dir,
	})
}
```

---

### Production URL will be:
```
GET /api/projects/drk/reviews/shots/pivot?page=1&perPage=15&orderKey=group1_only&direction=ASC
