// inside your route setup:
app.Get("/api/projects/:project/reviews/assets/pivot", func(c *fiber.Ctx) error {
	project := c.Params("project")
	root := "assets"

	perPage := c.QueryInt("per_page", 15)
	page := c.QueryInt("page", 1)
	if page < 1 { page = 1 }
	offset := (page - 1) * perPage

	sortKey := c.Query("sort", "group1_only")
	dir := strings.ToUpper(c.Query("dir", "ASC"))
	phase := c.Query("phase", "none") // "mdl" or "none"

	items, total, err := reviewInfoRepo.ListAssetsPivot(c.Context(), project, root, phase, sortKey, dir, perPage, offset)
	if err != nil {
		// log real error server-side; keep generic to client
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database error"})
	}

	// simple pager metadata
	lastPage := 1
	if perPage > 0 {
		lastPage = int((total + int64(perPage) - 1) / int64(perPage))
		if lastPage < 1 { lastPage = 1 }
	}

	return c.JSON(fiber.Map{
		"items":  items,
		"total":  total,
		"page":   page,
		"limit":  perPage,
		"sort":   sortKey,
		"dir":    dir,
		"phase":  phase,
		"last":   lastPage,
		"hasNext": page < lastPage,
	})
})
