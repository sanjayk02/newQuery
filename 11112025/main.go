// main.go
var sortKeyMap = map[string]string{
	"group_1":             "group1_only",
	"relation":            "relation_only",
	"submitted_at_utc":    "submitted_at_utc", // Generic (no phase)
	"modified_at_utc":     "modified_at_utc",  // Generic (no phase)
	"phase":               "phase",            // Generic (no phase)
	"group_rel_submitted": "group_rel_submitted", // Generic (no phase)

	// Add specific phase sort keys (New keys from frontend fix)
	"mdl_submitted": "mdl_submitted",
	"rig_submitted": "rig_submitted",
	"bld_submitted": "bld_submitted",
	"dsn_submitted": "dsn_submitted",
	"ldv_submitted": "ldv_submitted",

	"mdl_work": "mdl_work",
	"rig_work": "rig_work",
	"bld_work": "bld_work",
	"dsn_work": "dsn_work",
	"ldv_work": "ldv_work",

	"mdl_appr": "mdl_appr", // work status is used for approval status sort when phase is specified
	"rig_appr": "rig_appr",
	"bld_appr": "bld_appr",
	"dsn_appr": "dsn_appr",
	"ldv_appr": "ldv_appr",

	"work_status": "work_status", // Keep deprecated alias
}
