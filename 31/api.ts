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
import { Value } from "../../../new-pipeline-setting/types";
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

export const fetchAssets = async (
  project: string,
  page: number,
  rowsPerPage: number,
  signal?: AbortSignal | null,
): Promise<AssetsResponse> => {
  const headers = getAuthHeader();
  
  // Debug auth
  console.log('fetchAssets - Auth headers:', headers);

  let url: string = `/api/projects/${encodeURIComponent(project)}/reviews/assets`;

  const params = new URLSearchParams();
  params.set('per_page', String(rowsPerPage));
  params.set('page', String(page + 1));
  url += `?${params.toString()}`;

  console.log('fetchAssets URL:', url);

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

export const fetchAssetReviewInfos = async (
  project: string,
  asset: string,
  relation: string,
  signal?: AbortSignal | null,
): Promise<ReviewInfoListResponse> => {
  // FIXED: Proper URL encoding and structure
  const encodedProject = encodeURIComponent(project);
  const encodedAsset = encodeURIComponent(asset);
  const encodedRelation = encodeURIComponent(relation);
  
  const url = `/api/projects/${encodedProject}/assets/${encodedAsset}/relations/${encodedRelation}/reviewInfos`;

  console.log('fetchAssetReviewInfos URL:', url);

  const headers = getAuthHeader();
  const res = await fetch(url, {
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

export const fetchAssetThumbnail = async (
  project: string,
  asset: string,
  relation: string,
  signal?: AbortSignal | null,
): Promise<Response | null> => {
  // FIXED: Proper URL encoding
  const encodedProject = encodeURIComponent(project);
  const encodedAsset = encodeURIComponent(asset);
  const encodedRelation = encodeURIComponent(relation);
  
  const url = `/api/projects/${encodedProject}/assets/${encodedAsset}/relations/${encodedRelation}/reviewthumbnail`;
  
  console.log('fetchAssetThumbnail URL:', url);
  
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
    console.error('401 Unauthorized for thumbnail:', url);
    throw new AuthorizationError();
  }
  if (!res.ok) {
    throw new Error('Failed to fetch thumbnail.');
  }
  setNewToken(res);
  return res;
};

type ValueListResponse = Readonly<{
  values: Value[],
  next: string | null,
  total: number,
}>;

export const fetchPipelineSettingAssetComponents = async (
  project: string,
  signal?: AbortSignal | null,
): Promise<ValueListResponse> => {
  const encodedProject = encodeURIComponent(project);
  let url = `/api/pipelineSetting/preference/projects/${encodedProject}/values`;
  const params = new URLSearchParams();
  params.set('search_key', '/ppiTracker/assets/components/');
  url += `?${params}`;
  
  console.log('fetchPipelineSettingAssetComponents URL:', url);
  
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
    console.error('401 Unauthorized for pipeline settings:', url);
    throw new AuthorizationError();
  }
  if (!res.ok) {
    throw new Error('Failed to fetch values.');
  }
  const json: ValueListResponse = await res.json();
  setNewToken(res);

  return json;
};

export const fetchLatestAssetComponents = async (
  project: string,
  asset: string,
  relation: string,
  components: string[],
  signal?: AbortSignal | null,
): Promise<LatestAssetComponentDocumentsResponse[]> => {
  const encodedProject = encodeURIComponent(project);
  const encodedAsset = encodeURIComponent(asset);
  const encodedRelation = encodeURIComponent(relation);
  
  let url = `/api/projects/${encodedProject}/latestAssetsOperationInfos`;
  const headers = getAuthHeader();
  const params = new URLSearchParams();
  params.set('asset', encodedAsset);
  params.set('relation', encodedRelation);
  components.forEach(component => params.append('component', component));
  url += `?${params}`;
  
  console.log('fetchLatestAssetComponents URL:', url);
  
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
    console.error('401 Unauthorized for latest components:', url);
    throw new AuthorizationError();
  }
  if (!res.ok) {
    throw new Error('Failed to fetch latest asset components.');
  }
  setNewToken(res);
  const json: LatestAssetComponentDocumentsResponse[] = await res.json();
  return json;
};

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
      signal,
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

/* ========================================================================
   Fetch Assets Pivoted API
   - New function to fetch pivoted assets with filtering and sorting
   - Replaces previous fetchAssets implementation with enhanced functionality
   - Retains original fetchAssets and fetchAssetReviewInfos for backward compatibility
   - Uses URLSearchParams for cleaner query parameter handling
   - Encodes project, asset, and relation parameters to ensure URL safety
   - Improved error handling and response validation
   - Maintains consistent coding style with async/await and fetch API
   - Added comments for clarity and maintainability
   - Add by PSI
  ====================================================================== */
export const fetchAssetsPivot = async (
  project: string,
  page: number,
  rowsPerPage: number,
  sortKey: string,
  sortDir: string, // 'asc' | 'desc'
  phase: string,   // 'mdl' | 'rig' | 'bld' | 'dsn' | 'ldv' | 'none' | ''
  assetNameKey: string,       // Name filter (prefix, case-insensitive)
  approvalStatuses: string[], // Approval filter (OR within set)
  workStatuses: string[],     // Work filter (OR within set)
  view: 'list' | 'grouped', // View mode: list or grouped
  signal?: AbortSignal | null,
): Promise<AssetsPivotResponse> => {
  const headers = getAuthHeader();
  
  // Debug auth
  console.log('fetchAssetsPivot - Auth headers present:', !!headers.Authorization);
  
  const encodedProject = encodeURIComponent(project);
  let url = `/api/projects/${encodedProject}/reviews/assets/pivot`;

  const params = new URLSearchParams();
  params.set('per_page', String(rowsPerPage));
  params.set('page', String(page + 1));
  if (sortKey) params.set('sort', sortKey);
  if (sortDir) params.set('dir', sortDir.toUpperCase());
  if (phase)   params.set('phase', phase);

  // View mode parameter
  if (view) params.set('view', view);

  // ✅ Server expects these keys:
  // name (with name_mode=prefix), work (CSV), appr (CSV)
  const trimmed = (typeof assetNameKey === 'string' ? assetNameKey : '').trim();
  if (trimmed) {
    params.set('name', trimmed);
    params.set('name_mode', 'prefix'); // keep prefix per your spec
  }
  if (Array.isArray(workStatuses) && workStatuses.length > 0) {
    params.set('work', workStatuses.join(',')); // CSV
  }
  if (Array.isArray(approvalStatuses) && approvalStatuses.length > 0) {
    params.set('appr', approvalStatuses.join(',')); // CSV
  }

  url += `?${params.toString()}`;

  console.log('Fetching Assets Pivot with URL:', url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      mode: 'cors',
      signal: signal || controller.signal,
    });

    clearTimeout(timeoutId);
    
    console.log('Pivot Response status:', res.status);

    if (res.status === 401) {
      console.error('401 Unauthorized for pivot:', url);
      throw new AuthorizationError();
    }
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Pivot fetch failed:', res.status, errorText);
      throw new Error(`Failed to fetch pivoted assets: ${res.status} - ${errorText}`);
    }

    setNewToken(res);
    const json = await res.json() as AssetsPivotResponse;
    console.log('Pivot Response received');
    
    if (json && typeof json === 'object' && Array.isArray((json as any).groups)) {
      console.log('Number of groups received:', (json as any).groups.length);
    }
    return json;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Error in fetchAssetsPivot:', error);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds');
    }
    throw error;
  }
};
