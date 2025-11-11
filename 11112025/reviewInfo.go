// reviewInfo.go

// ---------- Dynamic Sorting Function ----------
func buildOrderClause(alias, key, dir string) string {
    // ... (dir and col function remain the same) ...

	switch key {
	// Generic Sorts (use column directly)
	case "submitted_at_utc", "modified_at_utc", "phase":
		return col(key) + " " + dir

	// Asset Name/Relation Sorts (use compound keys)
	case "group1_only":
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir, col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	case "relation_only":
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("relation"), dir, col("group_1"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	case "group_rel_submitted":
		return fmt.Sprintf("LOWER(%s) ASC, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)

	// Phase-Specific Sorts (use generic work/submitted status columns, let phase-bias handle the priority)
	case "mdl_submitted", "rig_submitted", "bld_submitted", "dsn_submitted", "ldv_submitted":
		// Sort by submitted_at_utc column, relying on `preferredPhase` to bring the right rows to the top.
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, %s %s",
			col("submitted_at_utc"), dir, col("group_1"), col("submitted_at_utc"), dir)
	
	case "mdl_work", "rig_work", "bld_work", "dsn_work", "ldv_work",
		"mdl_appr", "rig_appr", "bld_appr", "dsn_appr", "ldv_appr", "work_status":
		// Sort by work_status column, relying on `preferredPhase` to bring the right rows to the top.
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("work_status"), dir, col("group_1"), col("submitted_at_utc"), col("submitted_at_utc"), dir)

	// Default sort
	default:
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir, col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	}
}
