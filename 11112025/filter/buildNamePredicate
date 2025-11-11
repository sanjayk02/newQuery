// NEW: tiny helpers
func buildNamePredicate(nameKey, nameMode string) (cond string, arg any) {
	nameKey = strings.ToLower(strings.TrimSpace(nameKey))
	if nameKey == "" {
		return "", nil
	}
	if nameMode == "exact" {
		return "AND LOWER(group_1) = ?", nameKey
	}
	// default prefix
	return "AND LOWER(group_1) LIKE ?", nameKey + "%"
}

func buildStatusPredicate(work, appr []string) (cond string, args []any) {
	if len(work) == 0 && len(appr) == 0 {
		return "", nil
	}
	clauses := make([]string, 0, 2)
	if len(work) > 0 {
		place := strings.Repeat("?,", len(work))
		place = place[:len(place)-1]
		clauses = append(clauses, "LOWER(work_status) IN ("+place+")")
		for _, w := range work { args = append(args, strings.ToLower(w)) }
	}
	if len(appr) > 0 {
		place := strings.Repeat("?,", len(appr))
		place = place[:len(place)-1]
		clauses = append(clauses, "LOWER(approval_status) IN ("+place+")")
		for _, a := range appr { args = append(args, strings.ToLower(a)) }
	}
	return "AND (" + strings.Join(clauses, " OR ") + ")", args
}
