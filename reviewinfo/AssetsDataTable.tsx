// src/hooks.ts
import { useEffect, useMemo, useState } from 'react';
import type { PivotResponse, AssetPhaseSummary } from './types';
import { fetchPivot } from './api';

export function usePivotAssets(args: {
  project: string;
  root?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  phase?: string;
  page?: number;      // 1-based
  per_page?: number;
}) {
  const [data, setData] = useState<AssetPhaseSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<Error | null>(null);

  const params = useMemo(() => ({
    project: args.project,
    root: args.root ?? 'assets',
    sort: args.sort,
    dir: args.dir ?? 'asc',
    phase: args.phase,
    page: args.page ?? 1,
    per_page: args.per_page ?? 15,
  }), [args.project, args.root, args.sort, args.dir, args.phase, args.page, args.per_page]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setErr(null);

    fetchPivot(params)
      .then((res: PivotResponse) => {
        if (cancel) return;
        setData(res.data ?? []);
        setTotal(res.total ?? 0);
        setCount(res.count ?? 0);
      })
      .catch((e) => !cancel && setErr(e))
      .finally(() => !cancel && setLoading(false));

    return () => { cancel = true; };
  }, [params.project, params.root, params.sort, params.dir, params.phase, params.page, params.per_page]);

  return { data, total, count, loading, error: err };
}
