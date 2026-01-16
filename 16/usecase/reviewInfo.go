func (uc *ReviewInfo) ListAssetsPivot(
	ctx context.Context,
	project string,
	root string,
	preferredPhase string,
	sortKey string,
	direction string,
	limit int,
	offset int,
	assetNameKey string,
	approvalStatuses []string,
	workStatuses []string,
) ([]entity.AssetPivot, int64, error) {

	timeoutCtx, cancel := context.WithTimeout(ctx, uc.ReadTimeout)
	defer cancel()

	db := uc.repo.WithContext(timeoutCtx)
	if err := uc.checkForProject(db, project); err != nil {
		return nil, 0, err
	}

	list, total, err := uc.repo.ListAssetsPivot(
		timeoutCtx,
		project,
		root,
		preferredPhase,
		sortKey,
		direction,
		limit,
		offset,
		assetNameKey,
		approvalStatuses,
		workStatuses,
	)
	if err != nil {
		return nil, 0, err
	}

	out := make([]entity.AssetPivot, len(list))
	for i, v := range list {
		out[i] = entity.AssetPivot(v)
	}

	return out, total, nil
}
