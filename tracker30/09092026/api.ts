import { AuthorizationError } from '../../../auth/types';
import { getAuthHeader, setNewToken } from '../../../auth/util';
import { LatestShotComponentDocumentsResponse, ReviewInfo, Shot, ShotCamDataTypesResponse, ReviewShotsPivotResponse } from './types';

type ReviewInfoListResponse = {
  reviews: ReviewInfo[],
  next: string | null,
  total: number,
};

export type ShotsResponse = {
  shots: Shot[],
  total: number,
};

export const fetchShots = async (
  project: string,
  page: number,
  rowsPerPage: number,
  search?: string,
  approvalStatus?: string[],
  workStatus?: string[],
  signal?: AbortSignal | null,
): Promise<ShotsResponse> => {
  const headers = getAuthHeader();
  let url: string | null = `/api/projects/${project}/publishOperationInfo/shots`;
  const params = new URLSearchParams();
  params.set('per_page', String(rowsPerPage));
  params.set('page', String(page + 1));

  if (search && search.trim().length >= 3) {
    params.set('search', search.trim());
    console.log('Search param added:', search.trim());
  }
  
  if (approvalStatus && approvalStatus.length > 0) {
    console.log('Adding approval_status params:', approvalStatus);
    approvalStatus.forEach(s => {
      params.append('approval_status', s);
      console.log(`Added approval_status: ${s}`);
    });
  }
  
  if (workStatus && workStatus.length > 0) {
    console.log('Adding work_status params:', workStatus);
    workStatus.forEach(s => {
      params.append('work_status', s);
      console.log(`Added work_status: ${s}`);
    });
  }
  
  url += `?${params}`;
  console.log('Final URL:', url);
  console.log('Final Params:', params.toString());
  
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
    const errorText = await res.text();
    console.error('API Error Response:', errorText);
    throw new Error('Failed to fetch parameters.');
  }
  setNewToken(res);
  const json: ShotsResponse = await res.json();
  return json;
};

export const fetchShotReviewInfos = async (
  project: string,
  shot: string,
  relation: string,
  signal?: AbortSignal | null,
): Promise<ReviewInfoListResponse> => {
  let url = `/api/projects/${project}/shots/reviewInfos`;
  const headers = getAuthHeader();
  const params = new URLSearchParams();
  params.set('groups', String(shot));
  params.set('relation', String(relation));
  url += `?${params}`;
  
  try {
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
    
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Review infos request aborted');
      return { reviews: [], next: null, total: 0 };
    }
    throw error;
  }
};

export const fetchShotThumbnail = async (
  project: string,
  shots: string[],
  relation: string,
  signal?: AbortSignal | null,
): Promise<Response | null> => {
  let url = `/api/projects/${project}/shots/reviewthumbnail`;
  const headers = getAuthHeader();
  const params = new URLSearchParams();
  params.set('group1', shots[0]);
  params.set('group2', shots[1]);
  params.set('group3', shots[2]);
  params.set('relation', String(relation));
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
  if (res.status === 204) {
    return null;
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

export const fetchLatestShotComponents = async (
  project: string,
  shots: string[],
  relation: string,
  components: string[],
  signal?: AbortSignal | null,
): Promise<LatestShotComponentDocumentsResponse[]> => {
  let url = `/api/projects/${project}/latestShotsOperationInfos`;
  const headers = getAuthHeader();
  const params = new URLSearchParams();
  params.set('group1', shots[0]);
  params.set('group2', shots[1]);
  params.set('group3', shots[2]);
  params.set('relation', relation);
  components.forEach(component => params.append('component', component));
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
    throw new Error('Failed to fetch latest asset components.');
  }
  setNewToken(res);
  const json: LatestShotComponentDocumentsResponse[] = await res.json();
  return json;
};

export const fetchGenerateShotCsv = async (
  project: string,
  signal?: AbortSignal | null,
): Promise<Response | null> => {
  const encodedProject = encodeURIComponent(project);
  let url = `/api/projects/${encodedProject}/shots/generateCsv`;

  console.log('fetchGenerateShotCsv URL:', url);

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

const SHOT_ASSIGNMENT_PHASES = [
  'lay',
  'anm',
  'gnz',
  'mat',
  'fx',
  'cmp',
  'dsp',
  'cloth',
  'cfxhair',
  'rtcgnz',
  'rtcmat',
  'crd',
  'drw',
  'rtcdrw',
];

const SHOT_ASSIGNMENT_FIELD_ALIASES: { [phase: string]: string[] } = {
  lay: ['lay_assign_to', 'lay_assigned_to', 'layout_assigned_to'],
  anm: ['anm_assign_to', 'anm_assigned_to', 'animation_assigned_to'],
  gnz: ['gnz_assign_to', 'gnz_assigned_to', 'genzu_assigned_to'],
  mat: ['mat_assign_to', 'mat_assigned_to'],
  fx: ['fx_assign_to', 'fx_assigned_to'],
  cmp: ['cmp_assign_to', 'cmp_assigned_to', 'comp_assigned_to', 'compositing_assigned_to'],
  dsp: ['dsp_assign_to', 'dsp_assigned_to', 'display_assigned_to'],
  cloth: ['cloth_assign_to', 'cloth_assigned_to'],
  cfxhair: ['cfxhair_assign_to', 'cfxhair_assigned_to', 'cfhair_assign_to', 'cfhair_assigned_to'],
  rtcgnz: ['rtcgnz_assign_to', 'rtcgnz_assigned_to'],
  rtcmat: ['rtcmat_assign_to', 'rtcmat_assigned_to'],
  crd: ['crd_assign_to', 'crd_assigned_to'],
  drw: ['drw_assign_to', 'drw_assigned_to'],
  rtcdrw: ['rtcdrw_assign_to', 'rtcdrw_assigned_to'],
};

const normalizeAssignmentField = (value: string): string => (
  value.trim().toLowerCase().replace(/[\s-]+/g, '_')
);

const getAssignmentValueForPhase = (
  dataMap: Record<string, string | null | undefined>,
  phase: string,
): string => {
  const normalizedData = new Map<string, string | null | undefined>();
  Object.keys(dataMap).forEach((key) => {
    normalizedData.set(normalizeAssignmentField(key), dataMap[key]);
  });

  const aliases = SHOT_ASSIGNMENT_FIELD_ALIASES[phase] || [`${phase}_assign_to`];
  const value = aliases
    .map(alias => normalizedData.get(normalizeAssignmentField(alias)))
    .find(raw => raw != null && String(raw).trim() !== '');

  return value ? String(value) : '';
};

export type TrackerShotAssignmentEntity = {
  group?: string,
  data?: Record<string, string | null | undefined>,
};

export const fetchTrackerShotAssignmentValues = async (
  project: string,
  signal?: AbortSignal | null,
): Promise<TrackerShotAssignmentEntity[]> => {
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
        { key: 'root', operator: 'eq', value: 'shots' },
      ],
    }),
  });

  if (res.status === 401) throw new AuthorizationError();
  if (!res.ok) throw new Error('Failed to fetch tracker shot assignment values.');

  setNewToken(res);
  const data: TrackerShotAssignmentEntity[] = await res.json();

  return data;
};

const CAM_DATA_TYPES_CHUNK = 50; // keep each URL well under the server's size limit

export const fetchShotCamDataTypes = async (
    project: string,
    shots: string[],
    signal?: AbortSignal | null,
): Promise<ShotCamDataTypesResponse> => {
    // Nothing to fetch — short-circuit to avoid a wasted request.
    if (shots.length === 0) {
        return { items: {} };
    }

    // Split into chunks so the URL (one `shots=` per key) never grows large
    // enough to trip the server's 431 "Request Header Fields Too Large".
    const chunks: string[][] = [];
    for (let i = 0; i < shots.length; i += CAM_DATA_TYPES_CHUNK) {
        chunks.push(shots.slice(i, i + CAM_DATA_TYPES_CHUNK));
    }

    const merged: { [shotKey: string]: string } = {};

    for (const chunk of chunks) {
        const headers = getAuthHeader();            // fresh token per request (handles rotation)
        const params = new URLSearchParams();
        chunk.forEach(s => params.append('shots', s));

        const url = `/api/projects/${project}/shots/camDataTypes?${params.toString()}`;

        const res = await fetch(url, { method: 'GET', headers, mode: 'cors', signal });

        if (res.status === 401) throw new AuthorizationError();
        if (!res.ok) {
            const errorText = await res.text();
          console.error('[CamDataType API] Error response:', errorText);
            throw new Error('Failed to fetch cam data types.');
        }
        setNewToken(res);

        const json: ShotCamDataTypesResponse = await res.json();
        Object.assign(merged, json.items || {});
    }

    return { items: merged };
};

// New end - point types for shot pivot and related APIs
export type ReviewShotsPivotParams = {
  project:    string;
  page:       number;
  perPage:    number;
  orderKey?:  string;
  direction?: string;
  phases?:    string[];   // empty => backend resolves dynamically
  statuses?:  string[];   // empty => backend default ("check")
  signal?:    AbortSignal | null;
};

export const fetchReviewShotsPivot = async ({
    project,
    page,
    perPage,
    orderKey  = 'group1_only',
    direction = 'ASC',
    statuses  = [],
    signal,
}: ReviewShotsPivotParams): Promise<ReviewShotsPivotResponse> => {
    const headers = getAuthHeader();
    const params = new URLSearchParams();

    params.set('page', String(page));
    params.set('perPage', String(perPage));
    params.set('orderKey', orderKey);
    params.set('direction', direction);

    statuses.forEach(s => params.append('status', s));

    const url = `/api/projects/${project}/reviews/shots/checkPivot?${params.toString()}`;
    
    console.log('[fetchReviewShotsPivot] URL:', url);
    console.log('[fetchReviewShotsPivot] Statuses:', statuses);

    const res = await fetch(url, { method: 'GET', headers, mode: 'cors', signal });
    
    if (res.status === 401) throw new AuthorizationError();
    if (!res.ok) {
        const errorText = await res.text();
        console.error('fetchReviewShotsPivot error:', errorText);
        throw new Error('Failed to fetch review shots pivot.');
    }
    
    setNewToken(res);
    const data: ReviewShotsPivotResponse = await res.json();
    console.log('[fetchReviewShotsPivot] Response:', data);
    return data;
};
