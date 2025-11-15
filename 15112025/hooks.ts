export function useFetchAssetsPivot(
  project: Project | null | undefined,
  page: number,
  rowsPerPage: number,
  sortKey: string,
  sortDir: SortDir,      // 'asc' | 'desc' | 'none'
  phase: string,         // 'mdl' | 'rig' | 'bld' | 'dsn' | 'ldv' | 'none'
  assetNameKey: string,       // name filter
  approvalStatuses: string[], // approval filters
  workStatuses: string[],     // work filters
): { assets: AssetPhaseSummary[]; total: number } {
  const [assets, setAssets] = useState<AssetPhaseSummary[]>([]);
  const [total, setTotal] = useState(0);

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
          assetNameKey,
          approvalStatuses,
          workStatuses,
          controller.signal,
        );

        // Accept both shapes: {assets} (new) or {data} (legacy)
        const list =
          res && (res as any).assets ? (res as any).assets :
          res && (res as any).data   ? (res as any).data   : [];
        const count = res && (res as any).total ? (res as any).total : 0;

        setAssets(list);
        setTotal(count);

        // debug logs (optional)
        // eslint-disable-next-line no-console
        console.log('[HOOK][pivot] list:', list.length, list);
        // eslint-disable-next-line no-console
        console.log('[HOOK][pivot] total:', count);
      } catch (err) {
        if (controller.signal.aborted) return;
        const errName = err && (err as any).name ? (err as any).name : '';
        if (errName === 'AbortError') return;
        // eslint-disable-next-line no-console
        console.error(err);
      }
    })();

    return () => controller.abort();
  }, [
    project,
    page,
    rowsPerPage,
    sortKey,
    sortDir,
    phase,
    assetNameKey,
    approvalStatuses,
    workStatuses,
  ]);

  return { assets, total };
}
