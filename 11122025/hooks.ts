import { useEffect, useReducer, useState } from 'react';
import { Asset, ReviewInfo, AssetPhaseSummary, SortDir } from './types';
import { fetchAssets, fetchAssetReviewInfos, fetchAssetThumbnail, fetchAssetsPivot } from './api';
import { Project } from '../types';

// ... (useFetchAssets remains the same)

/* =========================================================
 * Pivot assets (sorted + optional phase bias)
 * =======================================================*/
export function useFetchAssetsPivot(
  project: Project | null | undefined,
  page: number,
  rowsPerPage: number,
  sortKey: string,
  sortDir: SortDir,      // 'asc' | 'desc' | 'none'
  phase: string,         // 'mdl' | 'rig' | 'bld' | 'dsn' | 'ldv' | 'none'
  assetNameKey: string,       // ADDED
  approvalStatuses: string[], // ADDED
  workStatuses: string[],     // ADDED
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
          assetNameKey,      // ADDED
          approvalStatuses,  // ADDED
          workStatuses,      // ADDED
          controller.signal,
        );

        // Accept both shapes: {assets} (new) or {data} (legacy)
        const list =
          res && (res as any).assets ? (res as any).assets :
          res && (res as any).data   ? (res as any).data   : [];
        const count = res && (res as any).total ? (res as any).total : 0;

        setAssets(list);
        setTotal(count);

        // debug (log the locals, not state)
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
  }, [project, page, rowsPerPage, sortKey, sortDir, phase, assetNameKey, approvalStatuses, workStatuses]); // Updated dependency array

  return { assets, total };
}

// ... (rest of the file)
