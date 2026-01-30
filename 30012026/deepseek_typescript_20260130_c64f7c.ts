// Enhanced useFetchAssetsPivot with progress tracking
export function useFetchAssetsPivot(
  project: Project | null | undefined,
  page: number,
  rowsPerPage: number,
  sortKey: string,
  sortDir: SortDir,
  phase: string,
  assetNameKey: string,
  approvalStatuses: string[],
  workStatuses: string[],
  viewMode: 'list' | 'grouped',
): { 
  assets: Asset[]; 
  total: number; 
  groups: PivotGroup[];
  isLoading: boolean;
  progress: number;
  error: Error | null;
} {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [groups, setGroups] = useState<PivotGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const projectKey = project ? project.key_name : undefined;

  useEffect(() => {
    if (!projectKey || sortDir === 'none') return;

    setIsLoading(true);
    setProgress(0);
    setError(null);
    
    const controller = new AbortController();

    (async () => {
      try {
        const res = await (fetchAssetsPivot as any)(
          projectKey,
          page,
          rowsPerPage,
          sortKey,
          sortDir,
          phase,
          assetNameKey,
          approvalStatuses,
          workStatuses,
          viewMode,
          {
            signal: controller.signal,
            onProgress: setProgress,
            timeout: 45000,
          }
        );

        const list = (res as any).assets || (res as any).data || [];
        const count = (res as any).total || 0;
        const serverGroups: PivotGroup[] = Array.isArray((res as any).groups) ? (res as any).groups : [];

        setAssets(list);
        setTotal(count);
        setGroups(serverGroups);
        setError(null);
      } catch (err) {
        if ((err as any).name === 'AbortError') return;
        console.error('Pivot fetch error:', err);
        setError(err as Error);
        
        // Set empty data on error to prevent UI crashes
        setAssets([]);
        setGroups([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
        setProgress(100);
      }
    })();

    return () => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    };
  }, [
    projectKey,
    page,
    rowsPerPage,
    sortKey,
    sortDir,
    phase,
    assetNameKey,
    approvalStatuses,
    workStatuses,
    viewMode,
  ]);

  return { assets, total, groups, isLoading, progress, error };
}