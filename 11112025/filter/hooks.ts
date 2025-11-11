export function useFetchAssetsPivot(
  project: Project | null | undefined,
  page: number,
  rowsPerPage: number,
  sortKey: string,
  sortDir: SortDir,
  phase: string,
  signalPhase?: AbortSignal,            // unchanged call site
  nameKey?: string,
  workStatuses: string[] = [],
  apprStatuses: string[] = [],
): { assets: AssetPhaseSummary[]; total: number } {
  // state...

  useEffect(() => {
    if (project == null) return;
    if (sortDir === 'none') return;

    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetchAssetsPivot(
          project.key_name,
          page,
          rowsPerPage,
          sortKey,
          sortDir,
          phase,
          controller.signal,
          nameKey,
          workStatuses,
          apprStatuses,
        );
        // set state...
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
      }
    })();

    return () => controller.abort();
  }, [project, page, rowsPerPage, sortKey, sortDir, phase, nameKey, workStatuses.join(','), apprStatuses.join(',')]);

  return { assets, total };
}
