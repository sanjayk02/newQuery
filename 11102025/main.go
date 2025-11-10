// main.go (excerpt)
package main

import (
	"log"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"your/module/repo"
)

func registerRoutes(app *fiber.App, reviewInfoRepo *repo.ReviewInfo) {
	app.Get("/api/projects/:project/reviews/assets/pivot", func(c *fiber.Ctx) error {
		project := c.Params("project")
		root := "assets"

		// query params
		perPage := c.QueryInt("per_page", 15) // default 15
		page := c.QueryInt("page", 1)
		if page < 1 {
			page = 1
		}
		offset := (page - 1) * perPage

		orderKey := c.Query("sort", "group1_only")
		dir := strings.ToUpper(c.Query("dir", "ASC"))
		phase := c.Query("phase", "none") // "mdl" or "none"

		// repo call
		pivots, total, err := reviewInfoRepo.ListAssetsPivot(c.Context(), project, root, phase, orderKey, dir, perPage, offset)
		if err != nil {
			log.Printf("[pivot] repo error: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "database error",
			})
		}

		// pagination headers
		baseURL := "/api/projects/" + project + "/reviews/assets/pivot"
		lastPage := 1
		if perPage > 0 {
			lastPage = int((total + int64(perPage) - 1) / int64(perPage))
			if lastPage < 1 {
				lastPage = 1
			}
		}
		makeURL := func(p int) string {
			return baseURL + "?per_page=" + strconv.Itoa(perPage) +
				"&page=" + strconv.Itoa(p) +
				"&sort=" + orderKey +
				"&dir=" + dir +
				"&phase=" + phase
		}
		var links []string
		links = append(links, `<`+makeURL(1)+`>; rel="first"`)
		links = append(links, `<`+makeURL(lastPage)+`>; rel="last"`)
		if page > 1 {
			links = append(links, `<`+makeURL(page-1)+`>; rel="prev"`)
		}
		if page < lastPage {
			links = append(links, `<`+makeURL(page+1)+`>; rel="next"`)
		}
		c.Set("Link", strings.Join(links, ", "))

		return c.JSON(fiber.Map{
			"total":  total,
			"page":   page,
			"limit":  perPage,
			"items":  pivots,
			"sort":   orderKey,
			"dir":    dir,
			"phase":  phase,
			"last":   lastPage,
			"hasNext": page < lastPage,
		})
	})
}
