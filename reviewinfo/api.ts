import { AuthorizationError } from '../../auth/types';
import { getAuthHeader, setNewToken } from '../../auth/util';
import { Asset, ReviewInfo } from './types';

type ReviewInfoListResponse = {
  reviews: ReviewInfo[],
  next: string | null,
  total: number,
};

export type AssetsResponse = {
  assets: Asset[],
  total: number,
};

export const fetchAssets = async (
  project: string,
  page: number,
  rowsPerPage: number,
  signal?: AbortSignal | null,
): Promise<AssetsResponse> => {
  const headers = getAuthHeader();
  let url: string | null = `/api/projects/${project}/reviews/assets`
  const params = new URLSearchParams();
  params.set('per_page', String(rowsPerPage));
  params.set('page', String(page + 1));
  url += `?${params}`;
  const res = await fetch(
    url,
    {
      method: 'GET',
      headers,
      mode: 'cors',
      signal,
    },
  );
  if (res.status === 401) {
    throw new AuthorizationError();
  }
  if (!res.ok) {
    throw new Error('Failed to fetch parameters.');
  }
  setNewToken(res);
  const json: AssetsResponse = await res.json();
  return json;
};

export const fetchAssetReviewInfos = async (
  project: string,
  asset: string,
  relation: string,
  signal?: AbortSignal | null,
): Promise<ReviewInfoListResponse> => {
  const url = `/api/projects/${project}/assets/${asset}/relations/${relation}/reviewInfos`;
  const headers = getAuthHeader();
  const res = await fetch(
    url,
    {
      method: 'GET',
      headers,
      mode: 'cors',
      signal,
    },
  );
  if (res.status === 401) {
    throw new AuthorizationError();
  }
  if (!res.ok) {
    throw new Error('Failed to fetch review infos.');
  }
  setNewToken(res);
  const json: ReviewInfoListResponse = await res.json();
  return json;
};

export const fetchAssetThumbnail = async (
  project: string,
  asset: string,
  relation: string,
  signal?: AbortSignal | null,
): Promise<Response | null> => {
  const url = `/api/projects/${project}/assets/${asset}/relations/${relation}/reviewthumbnail`;
  const headers = getAuthHeader();
  const res = await fetch(
    url,
    {
      method: 'GET',
      headers,
      mode: 'cors',
      signal,
    },
  );
  if (res.status === 204) {
    return null; // 204 is allowed, it means the thumbnail does not exist.
  }
  if (res.status === 401) {
    throw new AuthorizationError();
  }
  if (!res.ok) {
    throw new Error('Failed to fetch thumbnail.');
  }
  setNewToken(res);
  return res;
};

// ===================================================================
// Archived api below -- src/api.ts
// ===================================================================
// src/api.ts
import type { PivotResponse } from './types';

export interface PivotParams {
  project: string;
  root?: string;
  sort?: string;          // "group_1" | "mdl_work" | "-ldv_submitted" (either form)
  dir?: 'asc' | 'desc';   // optional when using minus form
  phase?: string;         // "mdl" | "rig" | "bld" | "dsn" | "ldv"
  page?: number;          // 1-based
  per_page?: number;
}

export async function fetchPivot(params: PivotParams): Promise<PivotResponse> {
  const {
    project,
    root = 'assets',
    sort,
    dir,
    phase,
    page = 1,
    per_page = 15,
  } = params;

  const q = new URLSearchParams({
    root,
    page: String(page),
    per_page: String(per_page),
  });

  if (sort) q.set('sort', sort);
  if (dir) q.set('dir', dir);
  if (phase) q.set('phase', phase);

  const url = `/api/assets/${encodeURIComponent(project)}/pivot?${q.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Pivot fetch failed (${res.status}): ${msg}`);
  }
  return res.json();
}
