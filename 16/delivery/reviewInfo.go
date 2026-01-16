type listAssetsPivotParams struct {
	Root   string `form:"root"`
	Sort   string `form:"sort"`
	Dir    string `form:"dir"`
	Phase  string `form:"phase"`
	Name   string `form:"name"`
	View   string `form:"view"`
	Work   string `form:"work"`
	Appr   string `form:"appr"`
	PerPage int   `form:"per_page"`
	Page    int   `form:"page"`
}
