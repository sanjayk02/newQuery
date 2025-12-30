/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    hooks.ts

  Module Description:
    Type definitions and hooks for asset data management.

  Details:
    - Defines React hooks for fetching and managing asset data, including assets, 
      review infos, thumbnails, and latest components.
            
  Update and Modification History:
    * - 29-10-2025 - SanjayK PSI - Initial creation sorting pagination implementation.
    * - 20-11-2025 - SanjayK PSI - Fixed typo in filter property names handling.

  Functions:
    * useFetchAssets: Hook to fetch a paginated list of assets for a given project.
    * useFetchAssetReviewInfos: Hook to fetch review information for a list of assets.
    * useFetchAssetThumbnails: Hook to fetch thumbnails for a list of assets.
    * useFetchPipelineSettingAssetComponents: Hook to fetch asset component values from pipeline settings.
    * useFetchLatestAssetComponents: Hook to fetch the latest documents for specified asset components.
    * useFetchAssetsPivot: Hook to fetch a paginated, sorted, and filtered list of asset phase summaries for a given project.
  * ───────────────────────────────────────────────────────────────────────── */
 
import { useEffect, useMemo, useState } from 'react';
import { useReducer } from 'react';
import { Asset, LatestAssetComponentDocument, LatestComponents, PivotGroup, ReviewInfo, SortDir } from './types'; // added SortDir import
import {
  fetchAssets,
  fetchAssetReviewInfos,
  fetchAssetThumbnail,
  fetchLatestAssetComponents,
  fetchPipelineSettingAssetComponents,
  fetchAssetsPivot
} from './api';
import { Project } from '../types';

export function useFetchAssets(
  project: Project | null | undefined,
  page: number,
  rowsPerPage: number,
): { assets: Asset[]; total: number } {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (project == null) return;

    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetchAssets(project.key_name, page, rowsPerPage, controller.signal);
        const list = res && (res as any).assets ? (res as any).assets : [];
        const count = res && (res as any).total ? (res as any).total : 0;

        setAssets(list);
        setTotal(count);

      } catch (err) {
        if (controller.signal.aborted) return;
        const errName = err && (err as any).name ? (err as any).name : '';
        if (errName === 'AbortError') return;
        console.error(err);
      }
    })();

    return () => controller.abort();
  }, [project, page, rowsPerPage]);

  return { assets, total };
};

function reducer(
  state: { [key: string]: ReviewInfo },
  action: { asset: Asset, reviewInfos: ReviewInfo[] },
): { [key: string]: ReviewInfo } {
  const data: { [key: string]: ReviewInfo } = {};
  for (const reviewInfo of action.reviewInfos) {
    data[`${action.asset.root}-${action.asset.relation}-${reviewInfo.phase}`] = reviewInfo;
  }
  return { ...state, ...data };
};

export function useFetchAssetReviewInfos(
  project: Project,
  assets: Asset[],
): { reviewInfos: { [key: string]: ReviewInfo } } {
  const [reviewInfos, dispatch] = useReducer(reducer, {});
  const controller = new AbortController();

  useEffect(() => {
    const loadAssetReviewInfos = async (asset: Asset) => {
      try {
        const res = await fetchAssetReviewInfos(
          project.key_name,
          asset.root,
          asset.relation,
          controller.signal,
        );
        const data = res.reviews;
        if (data.length > 0) {
          dispatch({ asset, reviewInfos: data });
        }
      } catch (err) {
        console.error('Failed to fetch asset review infos:', err);
      }
    };

    for (const asset of assets) {
      loadAssetReviewInfos(asset);
    }

    return () => controller.abort();
  }, [project, assets]);

  return { reviewInfos };
};

type PivotGroup = {
  top_group_node: string;
  items: Asset[];
};

/**
 * React hook to fetch a paginated, sorted, and filtered list of asset phase summaries for a given project.
 *
 * Fetches asset data from the backend using the provided parameters, supporting sorting, pagination,
 * phase filtering, asset name filtering, approval status filtering, and work status filtering.
 * Handles both new and legacy response shapes from the backend.
 *
 * @param project - The project for which to fetch asset data. If null or undefined, no fetch is performed.
 * @param page - The current page number (zero-based) for pagination.
 * @param rowsPerPage - The number of rows to fetch per page.
 * @param sortKey - The key by which to sort the asset data.
 * @param sortDir - The direction of sorting: 'asc', 'desc', or 'none'. No fetch is performed if 'none'.
 * @param phase - The asset phase to filter by: 'mdl', 'rig', 'bld', 'dsn', 'ldv', or 'none'.
 * @param assetNameKey - (ADDED) The asset name key to filter assets by.
 * @param approvalStatuses - (ADDED) Array of approval statuses to filter assets by.
 * @param workStatuses - (ADDED) Array of work statuses to filter assets by.
 * @returns An object containing:
 *   - assets: The filtered, sorted, and paginated list of asset phase summaries.
 *   - total: The total number of assets matching the filters.
 *
 * @remarks
 * - Aborts the fetch request if the component unmounts or dependencies change.
 * - Logs the fetched list and total to the console for debugging.
 * - Handles both `{ assets, total }` (new) and `{ data, total }` (legacy) response shapes.
 */
// export function useFetchAssetsPivot(
//   project: Project | null | undefined,
//   page: number,
//   rowsPerPage: number,
//   sortKey: string,
//   sortDir: SortDir,
//   phase: string,
//   assetNameKey: string,
//   approvalStatuses: string[],
//   workStatuses: string[],
//   viewMode: 'list' | 'grouped',     // ✅ add
// ): { assets: Asset[]; total: number; groups: PivotGroup[] } {
//   const [assets, setAssets] = useState<Asset[]>([]);
//   const [groups, setGroups] = useState<PivotGroup[]>([]);
//   const [total, setTotal] = useState(0);

//   useEffect(() => {
//     if (project == null) return;
//     if (sortDir === 'none') return;

//     const controller = new AbortController();

//     (async () => {
//       try {
//         const res = await fetchAssetsPivot(
//           project.key_name,
//           page,
//           rowsPerPage,
//           sortKey,
//           sortDir,
//           phase,
//           assetNameKey,
//           approvalStatuses,
//           workStatuses,
//           viewMode,                 // ✅ pass view
//           controller.signal,
//         );

//         const list =
//           (res as any).assets || (res as any).data || [];
//         const count =
//           (res as any).total || 0;

//         const serverGroups: PivotGroup[] =
//           Array.isArray((res as any).groups) ? (res as any).groups : [];

//         setAssets(list);
//         setTotal(count);
//         setGroups(serverGroups);

//         console.log('[HOOK][pivot] view:', viewMode);
//         console.log('[HOOK][pivot] assets:', list.length);
//         console.log('[HOOK][pivot] groups:', serverGroups.length);
//       } catch (err) {
//         if (controller.signal.aborted) return;
//         if ((err as any).name === 'AbortError') return;
//         console.error(err);
//       }
//     })();

//     return () => controller.abort();
//   }, [
//     project, page, rowsPerPage,
//     sortKey, sortDir, phase,
//     assetNameKey, approvalStatuses, workStatuses,
//     viewMode, // ✅ important dependency
//   ]);

//   return { assets, total, groups };
// }

function assetThumbnailReducer(
  state: { [key: string]: string },
  action: { asset: Asset, responseResult: string },
): { [key: string]: string } {
  const data: { [key: string]: string } = {};
  data[`${action.asset.root}-${action.asset.relation}`] = action.responseResult;
  return { ...state, ...data };
};

export function useFetchAssetThumbnails(
  project: Project,
  assets: Asset[],
): { thumbnails: { [key: string]: string } } {
  const [thumbnails, dispatch] = useReducer(assetThumbnailReducer, {});
  const controller = new AbortController();

  useEffect(() => {
    const loadAssetThumbnails = async (asset: Asset) => {
      try {
        const res = await fetchAssetThumbnail(
          project.key_name,
          asset.root,
          asset.relation,
          controller.signal,
        );
        if (res != null && res.ok) {
          const reader = new FileReader();
          const blob = await res.blob();
          reader.onload = () => {
            dispatch({ asset, responseResult: reader.result as string });
          };
          reader.readAsDataURL(blob);
        }
      } catch (err) {
        console.error(err);
      }
    };

    for (const asset of assets) {
      loadAssetThumbnails(asset);
    }

    return () => controller.abort();
  }, [project, assets]);

  return { thumbnails };
};

export function useFetchPipelineSettingAssetComponents(
  project: Project | null | undefined,
): { phaseComponents: { [key: string]: string[] } } {
  const [phaseComponents, setPhaseComponents] = useState<{ [key: string]: string[] }>({});

  useEffect(() => {
    if (project == null) {
      return;
    }
    const controller = new AbortController();
    (async () => {
      const res = await fetchPipelineSettingAssetComponents(
        project.key_name,
        controller.signal,
      ).catch((err) => {
        if (err.name === 'AbortError') {
          return;
        }
        console.error(err);
      });
      if (res != null) {
        const _phaseComponents: { [key: string]: string[] } = {};
        for (const value of res.values) {
          const keys = value.key.split('/');
          const phase = keys[keys.length - 1];
          _phaseComponents[phase] = value.value as string[];
        }
        setPhaseComponents(_phaseComponents);
      }
    })();
    return () => controller.abort();
  }, [project]);

  return { phaseComponents };
};

export function useFetchLatestAssetComponents(
  project: Project | null | undefined,
  assets: Asset[],
  components: { [key: string]: string[]; },
): { latestComponents: LatestComponents } {
  const [latestComponents, setLatestComponents] = useState<LatestComponents>({});

  useEffect(() => {
    if (project == null) {
      return;
    }
    const controller = new AbortController();
    const _components = Object.values(components).flat();

    const loadLatestAssetComponents = async () => {
      // NOTE:
      // API expects `asset` to be the asset name (group_1 / leaf_group_name),
      // not the root table name.
      // Passing `asset.root` caused requests like: asset=undefined
      // on datasets where `root` is not present.
      const fetchPromises = assets.map(asset =>
        fetchLatestAssetComponents(
          project.key_name,
          // Prefer group_1 (asset name in our UI/DB), fallback to leaf_group_name.
          (asset as any).group_1 || (asset as any).leaf_group_name || '',
          asset.relation,
          _components,
          controller.signal,
        )
      );

      try {
        // Promise.all を使用してすべての非同期処理が完了するのを待つ
        const results = await Promise.all(fetchPromises);

        const _latestComponents: LatestComponents = {};
        results.forEach((res, index) => {
          if (res.length > 0) {
            const rootKey = (assets[index] as any).root || 'assets';
            _latestComponents[`${rootKey}-${assets[index].relation}`] = res;
          }
        });
        setLatestComponents(_latestComponents);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        console.error('Failed to fetch latest asset components:', err);
      }
    };

    loadLatestAssetComponents();

    return () => {
      controller.abort();
    };
  }, [project, assets, components]);

  return { latestComponents };
};

/* ──────────────────────────────────────────────────────────────────────────
  End of Module
  ───────────────────────────────────────────────────────────────────────── */

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
): { assets: Asset[]; total: number; groups: PivotGroup[] } {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [groups, setGroups] = useState<PivotGroup[]>([]);
  const [total, setTotal] = useState(0);

  const projectKey = project ? project.key_name : undefined;

// In grouped view we fetch a big "list" page and build groups client-side.
// This prevents server paging from splitting a group (e.g. CHARACTER total 15 but only 8 shown).
const effectivePage = viewMode === 'grouped' ? 0 : page;
const effectiveRowsPerPage = viewMode === 'grouped' ? 5000 : rowsPerPage;
const effectiveView: 'list' | 'grouped' = viewMode === 'grouped' ? 'list' : viewMode;


  useEffect(() => {
    if (!projectKey || sortDir === 'none') return;

    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetchAssetsPivot(
          projectKey,
          effectivePage,
          effectiveRowsPerPage,
          sortKey,
          sortDir,
          phase,
          assetNameKey,
          approvalStatuses,
          workStatuses,
          effectiveView,
          controller.signal,
        );

        // list endpoint returns { assets: Asset[], total: number }
        // grouped endpoint returns { groups: [{top_group_node, items}], total, ... } (or similar)
        const list = (res as any).assets || (res as any).data || [];
        const count = (res as any).total || 0;

        const serverGroups: PivotGroup[] =
          Array.isArray((res as any).groups) ? (res as any).groups : [];

        setAssets(list);
        setTotal(count);
        setGroups(viewMode === 'grouped' ? [] : serverGroups);
      } catch (err) {
        if ((err as any).name === 'AbortError') return;
        console.error(err);
      }
    })();

    return () => controller.abort();
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

  return { assets, total, groups };
}