const { assets, total } = useFetchAssetsPivot(
  currentProject,
  pageProps.page,
  pageProps.rowsPerPage,
  sortKey,
  sortDir,
  phasePriority,
  undefined,
  filterProps.assetNameKey,
  filterProps.workStatues,
  filterProps.applovalStatues,
);
