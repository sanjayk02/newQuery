// hooks.ts
import { useEffect, useState } from 'react';
import { Project } from '../types'; // adjust import
import { fetchAssetsPivot, AssetPivot } from './api';

export function useFetchAssetsPivot(
  project: Project | null | undefined,
  page: number,
  rowsPerPage: number,
  sortKey: string,
  sortDir: 'asc' | 'desc',
  phase: string,
  assetNameKey: string,
  approvalStatuses: string[],
  workStatuses: string[],
): { assets: AssetPivot[]; total: number } {
  const [assets, setAssets] = useState<AssetPivot[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchAssetsPivot(
          project,
          page,
          rowsPerPage,
          sortKey,
          sortDir,
          phase,
          assetNameKey,
          approvalStatuses,
          workStatuses,
        );
        if (cancelled) return;
        setAssets(data.assets || []);
        setTotal(data.total || 0);
      } catch (e) {
        if (cancelled) return;
        console.error('useFetchAssetsPivot error', e);
        setAssets([]);
        setTotal(0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    project,
    page,
    rowsPerPage,
    sortKey,
    sortDir,
    phase,
    assetNameKey,
    approvalStatuses.join(','),
    workStatuses.join(','),
  ]);

  return { assets, total };
}
