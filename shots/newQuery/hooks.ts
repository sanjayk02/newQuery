import { fetchReviewShotsPivot } from './api';


export function useReviewShotsPivot({
    project,
    page,
    perPage,
    orderKey       = 'group1_only',
    direction      = 'ASC',
    approvalStatus = [],
    workStatus     = [],
    // nameKey / shotsGroups / phase are accepted for call-site compatibility but
    // the checkPivot endpoint does not use them (review-queue is status-driven).
}: UseShotsPivotParams): {
    shots:       ShotPivot[];
    total:       number;
    pageLast:    number;
    hasNext:     boolean;
    hasPrev:     boolean;
    loading:     boolean;
    groupCounts: { [key: string]: number };
    phases:      string[];
} {
    const [shots,     setShots]     = useState<ShotPivot[]>([]);
    const [total,     setTotal]     = useState(0);
    const [pageLast,  setPageLast]  = useState(0);
    const [hasNext,   setHasNext]   = useState(false);
    const [hasPrev,   setHasPrev]   = useState(false);
    const [loading,   setLoading]   = useState(false);
    const [phaseList, setPhaseList] = useState<string[]>([]);

    useEffect(() => {
        if (project == null) return;

        const controller = new AbortController();
        setLoading(true);

        // checkPivot takes a single status set (matched against work OR approval).
        // Merge the toolbar's two filter arrays so status filtering still works.
        const statuses = Array.from(new Set([...(approvalStatus ?? []), ...(workStatus ?? [])]));

        (async () => {
            try {
                const res = await fetchReviewShotsPivot({
                    project:   project.key_name,
                    page,
                    perPage,
                    orderKey,
                    direction: direction.toUpperCase(),
                    statuses,
                    signal: controller.signal,
                });
                setShots(res.items);
                setTotal(res.total);
                setPageLast(res.pageLast);
                setHasNext(res.hasNext);
                setHasPrev(res.hasPrev);
                setPhaseList(res.phases || []);
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return;
                console.error('useReviewShotsPivot error:', err);
            } finally {
                setLoading(false);
            }
        })();

        return () => controller.abort();
    }, [
        project, page, perPage, orderKey, direction,
        JSON.stringify(approvalStatus), JSON.stringify(workStatus),
    ]);

    // checkPivot has no group_1 counts; return {} so downstream `groupCounts`
    // usage keeps working (group filter menu simply has no totals).
    return { shots, total, pageLast, hasNext, hasPrev, loading, groupCounts: {}, phases: phaseList };
}


const { shots, total, groupCounts, loading } = useReviewShotsPivot({
