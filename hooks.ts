import { useEffect, useState, useReducer } from 'react';
import { Asset, ReviewInfo, AssetPhaseSummary } from './types'; // ADD AssetPhaseSummary
import { fetchAssets, fetchAssetReviewInfos, fetchAssetThumbnail, fetchAssetsPivot } from './api'; // ADD fetchAssetsPivot
import { Project } from '../types';

// REPLACED: The original useFetchAssets is replaced by useFetchAssetsPivot
// The original useFetchAssets (kept for context, but should be replaced/removed if not used elsewhere)
export function useFetchAssets(
  project: Project | null | undefined,
  page: number,
  rowsPerPage: number,
): { assets: Asset[], total: number } {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (project == null) {
      return;
    }
    const controller = new AbortController();

    (async () => {
      const res = await fetchAssets(
        project.key_name,
        page,
        rowsPerPage,
        controller.signal,
      ).catch((err) => {
        if (err.name === 'AbortError') {
          return;
        }
        console.error(err)
      });
      if (res != null) {
        setAssets(res.assets);
        setTotal(res.total);
      }
    })();
    return () => controller.abort();
  }, [project, page, rowsPerPage]);

  return { assets, total };
};

// NEW: Hook to fetch pivoted and sorted asset data
export function useFetchAssetsPivot(
  project: Project | null | undefined,
  page: number,
  rowsPerPage: number,
  sortKey: string, // ADD sortKey parameter
): { assets: AssetPhaseSummary[], total: number } { // RETURN AssetPhaseSummary[]
  const [assets, setAssets] = useState<AssetPhaseSummary[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (project == null) {
      return;
    }
    const controller = new AbortController();

    (async () => {
      const res = await fetchAssetsPivot( // USE NEW API FUNCTION
        project.key_name,
        page,
        rowsPerPage,
        sortKey, // PASS sortKey
        controller.signal,
      ).catch((err) => {
        if (err.name === 'AbortError') {
          return;
        }
        console.error(err)
      });
      if (res != null) {
        setAssets(res.data); // 'data' field from AssetsPivotResponse
        setTotal(res.total);
      }
    })();
    return () => controller.abort();
  }, [project, page, rowsPerPage, sortKey]); // ADD sortKey to dependencies

  return { assets, total };
};


// Existing reducer (kept as-is)
function reducer(
  state: { [key: string]: ReviewInfo },
  action: { asset: Asset, reviewInfos: ReviewInfo[] },
): { [key: string]: ReviewInfo } {
  const data: { [key: string]: ReviewInfo } = {};
  for (const reviewInfo of action.reviewInfos) {
    data[`${action.asset.name}-${action.asset.relation}-${reviewInfo.phase}`] = reviewInfo;
  }
  return { ...state, ...data };
};

// Existing useFetchAssetReviewInfos (kept as-is, though ideally no longer needed for pivot table)
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
          asset.name,
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

// Existing assetThumbnailReducer (kept as-is)
function assetThumbnailReducer(
  state: { [key: string]: string },
  action: { asset: Asset, responseResult: string },
): { [key: string]: string } {
  const data: { [key: string]: string } = {};
  data[`${action.asset.name}-${action.asset.relation}`] = action.responseResult;
  return { ...state, ...data };
};

// Existing useFetchAssetThumbnails (kept as-is)
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
          asset.name,
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

    // The asset type passed here is Asset, but the pivot function uses AssetPhaseSummary.
    // In AssetsDataTable.tsx we map AssetPhaseSummary to Asset for this hook call.

    for (const asset of assets) {
      loadAssetThumbnails(asset);
    }

    return () => controller.abort();
  }, [project, assets]);

  return { thumbnails };
};