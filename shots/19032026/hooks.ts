import { fetchShotsPivot } from './api';
import { ShotPivot, ShotsPivotResponse } from './types';

export type UseShotsPivotParams = {
  project: Project | null | undefined;
  page: number;
  perPage: number;
  orderKey?: string;
  direction?: string;
  phase?: string;
  nameKey?: string;
  approvalStatus?: string[];
  workStatus?: string[];
};

export function useShotsPivot({
  project,
  page,
  perPage,
  orderKey = 'group1_only',
  direction = 'ASC',
  phase = '',
  nameKey = '',
  approvalStatus = [],
  workStatus = [],
}: UseShotsPivotParams): {
  shots: ShotPivot[];
  total: number;
  pageLast: number;
  hasNext: boolean;
  hasPrev: boolean;
  loading: boolean;
} {
  const [shots,    setShots]    = useState<ShotPivot[]>([]);
  const [total,    setTotal]    = useState(0);
  const [pageLast, setPageLast] = useState(0);
  const [hasNext,  setHasNext]  = useState(false);
  const [hasPrev,  setHasPrev]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (project == null) return;

    const controller = new AbortController();
    setLoading(true);

    (async () => {
      try {
        const res = await fetchShotsPivot({
          project:       project.key_name,
          page,
          perPage,
          orderKey,
          direction,
          phase,
          nameKey,
          approvalStatus,
          workStatus,
          signal: controller.signal,
        });

        setShots(res.items);
        setTotal(res.total);
        setPageLast(res.pageLast);
        setHasNext(res.hasNext);
        setHasPrev(res.hasPrev);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.error('useShotsPivot error:', err);
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [
    project,
    page,
    perPage,
    orderKey,
    direction,
    phase,
    nameKey,
    JSON.stringify(approvalStatus),
    JSON.stringify(workStatus),
  ]);

  return { shots, total, pageLast, hasNext, hasPrev, loading };
}
