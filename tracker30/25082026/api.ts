/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    api.ts

  Module Description:
    Type definitions and API functions for asset data management.

  Details:
    - Defines interfaces and types for assets, table props, sorting, filtering, and related data structures.
        
  * Update and Modification History:
    * - 29-10-2025 - SanjayK PSI - Initial creation sorting pagination implementation.
    * - 20-11-2025 - SanjayK PSI - Fixed typo in filter property names handling.

  Functions:
    * fetchAssets: Fetches a paginated list of assets for a given project.
    * fetchAssetReviewInfos: Fetches review information for a specific asset and relation.
    * fetchAssetThumbnail: Fetches the thumbnail image for a specific asset and relation.
    * fetchPipelineSettingAssetComponents: Fetches asset component values from pipeline settings.
    * fetchLatestAssetComponents: Fetches the latest documents for specified asset components.
    * fetchGenerateAssetCsv: Initiates CSV generation for assets in a project.
    * fetchAssetsPivot: Fetches pivoted assets with filtering and sorting options. 
  * ───────────────────────────────────────────────────────────────────────── */
import { AuthorizationError } from '../../../auth/types';
import { getAuthHeader, setNewToken } from '../../../auth/util';
import { fetchPipelineSettingComponentsProject } from '../api';
import { Asset, LatestAssetComponentDocumentsResponse, ReviewInfo, AssetsPivotResponse } from './types';

type ReviewInfoListResponse = {
  reviews: ReviewInfo[],
  next: string | null,
  total: number,
};

export type AssetsResponse = {
  assets: Asset[],
  total: number,
};

export type LatestAssetCommentResponse = {
  documents: any[],
  prev: string | null,
  next: string | null,
  total: number,
};

export const fetchLatestAssetComment = async (
  project: string,
  path?: string,
  signal?: AbortSignal | null,
): Promise<LatestAssetCommentResponse> => {
  const encodedProject = encodeURIComponent(project);
  const params = new URLSearchParams();

  if (path) {
    params.set('path', path);
  }
  params.set('order_by', '-_id');
  params.set('page', '1');
  params.set('per_page', '1');

  const url = `/api/projects/${encodedProject}/collections/comment/documents?${params.toString()}`;
  const headers = getAuthHeader();

  const res = await fetch(url, {
    method: 'GET',
    headers,
    mode: 'cors',
    signal: signal || undefined,
  });

  if (res.status === 401) throw new AuthorizationError();
  if (!res.ok) throw new Error('Failed to fetch latest asset comment.');

  setNewToken(res);
  return await res.json();
};

/* ──────────────────────────────────────────────────────────────────────────
  Function: fetchAssets
  Description: Fetches a paginated list of assets for a given project.
  Parameters:
    - project: The name of the project to fetch assets for.
    - page: The page number to fetch (0-indexed).
    - rowsPerPage: The number of assets to fetch per page.
    - signal: Optional AbortSignal to cancel the request if needed.
  * ───────────────────────────────────────────────────────────────────────── */
export const fetchAssets = async (
  project: string,
  page: number,
  rowsPerPage: number,
  signal?: AbortSignal | null,
): Promise<AssetsResponse> => {
  const headers = getAuthHeader();
  
  let url: string = `/api/projects/${encodeURIComponent(project)}/reviews/assets`;

  const params = new URLSearchParams();
  params.set('per_page', String(rowsPerPage));
  params.set('page', String(page + 1));
  url += `?${params.toString()}`;

  const res = await fetch(url, {
      method: 'GET',
      headers,
      mode: 'cors',
      signal: signal || undefined,
  });

  if (res.status === 401) throw new AuthorizationError();
  if (!res.ok) throw new Error('Failed to fetch parameters.');

  setNewToken(res);
  const json: AssetsResponse = await res.json();
  return json;
};

/* ──────────────────────────────────────────────────────────────────────────
  Function: fetchAssetReviewInfos
  Description: Fetches review information for a specific asset and relation.
  Parameters:
    - project: The name of the project to fetch review infos for.
    - asset: The name of the asset to fetch review infos for.
    - relation: The relation of the asset to fetch review infos for.
    - signal: Optional AbortSignal to cancel the request if needed.
  * ───────────────────────────────────────────────────────────────────────── */
export const fetchAssetReviewInfos = async (
  project: string,
  asset: string,
  relation: string,
  signal?: AbortSignal | null,
): Promise<ReviewInfoListResponse> => {
  // FIXED: Proper URL encoding and structure
  const encodedProject  = encodeURIComponent(project);
  const encodedAsset    = encodeURIComponent(asset);
  const encodedRelation = encodeURIComponent(relation);
  
  // ✅ Single line — no whitespace injected into URL
  const url = `/api/projects/${encodedProject}/assets/${encodedAsset}/relations/${encodedRelation}/reviewInfos`;

  const headers = getAuthHeader();
  const res     = await fetch(url, {
      method: 'GET',
      headers,
      mode: 'cors',
      signal: signal || undefined,
  });

  if (res.status === 401) {
    console.error('401 Unauthorized for review infos:', url);
    throw new AuthorizationError();
  }
  if (!res.ok) throw new Error('Failed to fetch review infos.');

  setNewToken(res);

  const json = await res.json();
  // Basic validation to ensure expected structure
  if (!json || !Array.isArray(json.reviews) || typeof json.total !== 'number') {
    throw new Error('Invalid response format for review infos.');
  }
  return json as ReviewInfoListResponse;
};

/* ──────────────────────────────────────────────────────────────────────────
  Function: fetchAssetThumbnail
  Description: Fetches the thumbnail for a specific asset and relation.
  Parameters:
    - project: The name of the project to fetch the thumbnail for.
    - asset: The name of the asset to fetch the thumbnail for.
    - relation: The relation of the asset to fetch the thumbnail for.
    - signal: Optional AbortSignal to cancel the request if needed.
  * ───────────────────────────────────────────────────────────────────────── */
export const fetchAssetThumbnail = async (
  project: string,
  asset: string,
  relation: string,
  signal?: AbortSignal | null,
): Promise<Response | null> => {
  if (!project || !asset || !relation) {
    console.warn('[Thumbnail] SKIPPED - missing params:', { project, asset, relation });
    return null;
  }

  const encodedProject  = encodeURIComponent(project);
  const encodedAsset    = encodeURIComponent(asset);
  const encodedRelation = encodeURIComponent(relation);

  const url = `/api/projects/${encodedProject}/assets/${encodedAsset}/relations/${encodedRelation}/reviewthumbnail`;

  const headers = getAuthHeader();
  const res = await fetch(url, {
    method: 'GET',
    headers,
    mode: 'cors',
    signal: signal || undefined,
  });

  if (res.status === 401) {
    console.error('[Thumbnail] 401 Unauthorized for thumbnail:', url);
    throw new AuthorizationError();
  }
  if (!res.ok) {
    console.error('[Thumbnail] FAILED', res.status, url);
    throw new Error('Failed to fetch thumbnail.');
  }

  setNewToken(res);
  return res;
};

/* ──────────────────────────────────────────────────────────────────────────
  Function: fetchPipelineSettingAssetComponents
  Description: Fetches the asset component values from pipeline settings for a given project.
  Parameters:
    - project: The name of the project to fetch settings for.
    - signal: Optional AbortSignal to cancel the request if needed.

  * ───────────────────────────────────────────────────────────────────────── */
export const fetchThumbnailVisibilitySetting = async (
  project: string,
  signal?: AbortSignal | null,
): Promise<boolean> => {

  const headers = getAuthHeader();
  const encodedProject = encodeURIComponent(project);

  // Query the correct path — /ppiTracker/assets/thumbnail/ (NOT /components/)
  const searchKey = encodeURIComponent('/ppiTracker/assets/thumbnail/');
  const url = `/api/pipelineSetting/preference/projects/${encodedProject}/values?search_key=${searchKey}`;

  const res = await fetch(url, {
    method: 'GET',
    headers,
    mode: 'cors',
    signal: signal || undefined,
  });

  if (res.status === 401) throw new AuthorizationError();
  if (!res.ok) {
    console.warn('[ThumbnailVisibility] API returned', res.status);
    return true; // default to showing thumbnails if setting fetch fails
  }

  setNewToken(res);
  const json = await res.json();

  // Find the enable key: /ppiTracker/assets/thumbnail/enable
  const match = (json.values || []).find((v: any) =>
    v.key.includes('/ppiTracker/assets/thumbnail/enable')
  );

  return match ? Boolean(match.value) : true;
  // return true; // Forcing true for now until we confirm the setting key and value structure
};

/* ──────────────────────────────────────────────────────────────────────────
  Function: fetchPipelineSettingComponentsDefault
  Description: Fetches the default asset component values from pipeline settings.
  Parameters:
    - root: The root key to search for in pipeline settings.
    - signal: Optional AbortSignal to cancel the request if needed.
  * ───────────────────────────────────────────────────────────────────────── */
export const fetchLatestAssetComponents = async (
  project: string,
  asset: string,
  relation: string,
  components: string[],
  signal?: AbortSignal | null,
): Promise<LatestAssetComponentDocumentsResponse[]> => {
  let url = `/api/projects/${project}/latestAssetsOperationInfos`;
  const headers = getAuthHeader();
  const params = new URLSearchParams();
  params.set('asset', asset);
  params.set('relation', relation);
  components.forEach(component => params.append('component', component));
  url += `?${params.toString()}`;
  const res = await fetch(
    url,
    {
      method: 'GET',
      headers,
      mode: 'cors',
      signal: signal || undefined,
    },
  );
  if (res.status === 401) {
    throw new AuthorizationError();
  }
  if (!res.ok) {
    throw new Error('Failed to fetch latest asset components.');
  }
  setNewToken(res);
  const json: LatestAssetComponentDocumentsResponse[] = await res.json();
  return json;
};

/* ──────────────────────────────────────────────────────────────────────────
  Function: fetchGenerateAssetCsv
  Description: Initiates the generation of a CSV file for assets in a project.
  Parameters:
    - project: The name of the project to generate the CSV for.
    - signal: Optional AbortSignal to cancel the request if needed.
  * ───────────────────────────────────────────────────────────────────────── */
export const fetchGenerateAssetCsv = async (
  project: string,
  signal?: AbortSignal | null,
): Promise<Response | null> => {
  const encodedProject = encodeURIComponent(project);
  let url = `/api/projects/${encodedProject}/assets/generateCsv`;
  
  console.log('fetchGenerateAssetCsv URL:', url);
  
  const headers = getAuthHeader();
  const res = await fetch(
    url,
    {
      method: 'GET',
      headers,
      mode: 'cors',
      signal: signal || undefined,
    },
  );
  if (res.status === 401) {
    console.error('401 Unauthorized for CSV generation:', url);
    throw new AuthorizationError();
  }
  if (!res.ok) {
    throw new Error('Failed to generate CSV.');
  }
  setNewToken(res);
  return res;
};

export type TrackerAssignmentEntity = {
  group?: string,
  data?: {
    dsn_assign_to?: string | null,
    modeling_assigned_to?: string | null,
    rigging_assigned_to?: string | null,
    lookdev_assigned_to?: string | null,
  },
};

export const fetchTrackerAssignmentValues = async (
  project: string,
  signal?: AbortSignal | null,
): Promise<TrackerAssignmentEntity[]> => {
  const encodedProject = encodeURIComponent(project);
  const url = `/api/projects/${encodedProject}/tracker/entities/search`;
  const headers = {
    ...getAuthHeader(),
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    mode: 'cors',
    signal: signal || undefined,
    body: JSON.stringify({
      filters: [
        { key: 'root', operator: 'eq', value: 'assets' },
      ],
      fields: [
        'group',
        'dsn_assign_to',
        'modeling_assigned_to',
        'rigging_assigned_to',
        'lookdev_assigned_to',
      ],
    }),
  });

  if (res.status === 401) throw new AuthorizationError();
  if (!res.ok) throw new Error('Failed to fetch tracker assignment values.');

  setNewToken(res);
  const data: TrackerAssignmentEntity[] = await res.json();

  return data;
};

/* ──────────────────────────────────────────────────────────────────────────
  Updated fetchLatestAssetComponents and fetchGenerateAssetCsv to include 
  URL encoding for project names and added console logs for debugging.
  Also added a timeout mechanism to fetchAssetsPivot to prevent hanging requests.
  * - 15-12-2025 - SanjayK PSI - Added URL encoding and timeout for API calls.
  * ───────────────────────────────────────────────────────────────────────── */
 export const fetchAssetsPivot = async (
  project: string,
  page: number,
  rowsPerPage: number,
  sortKey: string,
  sortDir: string,
  phase: string,
  assetNameKey: string,
  approvalStatuses: string[],
  workStatuses: string[],
  view: 'list' | 'grouped',
  signal?: AbortSignal | null,
): Promise<AssetsPivotResponse> => {
  const headers       = getAuthHeader();
  const encodedProject = encodeURIComponent(project);
  let url = `/api/projects/${encodedProject}/reviews/assets/pivot`;

  const params = new URLSearchParams();
  params.set('per_page', String(rowsPerPage));
  params.set('page', String(page + 1));
  
  // Map UI sort keys to backend sort keys
  let backendSortKey = sortKey;
  
  // Component columns mapping
  const componentColumns = ['mdlRend', 'bldAnm', 'bldRend', 'ldvMdl'];
  if (componentColumns.includes(sortKey)) {
    backendSortKey = sortKey; // Send as-is to backend
  }
  
  if (backendSortKey && backendSortKey !== 'none') {
    params.set('sort', backendSortKey);
  }
  
  if (sortDir && sortDir !== 'none') {
    params.set('dir', sortDir.toUpperCase());
  }
  
  if (phase && phase !== 'none') {
    params.set('phase', phase);
  }
  
  if (view) {
    params.set('view', view);
  }

  const trimmed = (assetNameKey || '').trim();
  if (trimmed) {
    params.set('name', trimmed);
    params.set('name_mode', 'prefix');
  }

  if (workStatuses.length) {
    params.set('work', workStatuses.join(','));
  }
  
  if (approvalStatuses.length) {
    params.set('appr', approvalStatuses.join(','));
  }

  url += `?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      mode: 'cors',
      signal: signal || controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Pivot API Error [${res.status}]: ${errorText}`);
    }

    setNewToken(res);
    return await res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};
