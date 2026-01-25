// hooks.ts - Updated loadLatestAssetComponents
export function useFetchLatestAssetComponents(
  project: Project | null | undefined,
  assets: Asset[],
  components: { [key: string]: string[]; },
): { latestComponents: LatestComponents } {
  const [latestComponents, setLatestComponents] = useState<LatestComponents>({});

  useEffect(() => {
    if (project == null || assets.length === 0) {
      return;
    }
    const controller = new AbortController();
    const _components = Object.values(components).flat();

    const loadLatestAssetComponents = async () => {
      // ✅ FIX: Filter out assets that don't have a valid identifier to prevent 400 errors
      const validAssets = assets.filter(asset => 
        (asset as any).group_1 || (asset as any).leaf_group_name
      );

      const fetchPromises = validAssets.map(asset =>
        fetchLatestAssetComponents(
          project.key_name,
          (asset as any).group_1 || (asset as any).leaf_group_name,
          asset.relation,
          _components,
          controller.signal,
        )
      );

      try {
        const results = await Promise.all(fetchPromises);
        const _latestComponents: LatestComponents = {};
        
        results.forEach((res, index) => {
          if (res && res.length > 0) {
            const rootKey = (validAssets[index] as any).root || 'assets';
            _latestComponents[`${rootKey}-${validAssets[index].relation}`] = res;
          }
        });
        setLatestComponents(_latestComponents);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Failed to fetch latest asset components:', err);
      }
    };

    loadLatestAssetComponents();
    return () => controller.abort();
  }, [project, assets, components]);

  return { latestComponents };
};
