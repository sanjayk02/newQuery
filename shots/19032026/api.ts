// Add new pivot fetch
export type ShotsPivotParams = {
  project: string;
  page: number;
  perPage: number;
  orderKey?: string;
  direction?: string;
  phase?: string;
  nameKey?: string;
  approvalStatus?: string[];
  workStatus?: string[];
  signal?: AbortSignal | null;
};

export const fetchShotsPivot = async ({
  project,
  page,
  perPage,
  orderKey = 'group1_only',
  direction = 'ASC',
  phase = '',
  nameKey = '',
  approvalStatus = [],
  workStatus = [],
  signal,
}: ShotsPivotParams): Promise<ShotsPivotResponse> => {
  const headers = getAuthHeader();
  const params = new URLSearchParams();

  params.set('page',      String(page));
  params.set('perPage',   String(perPage));
  params.set('orderKey',  orderKey);
  params.set('direction', direction);

  if (phase)   params.set('phase',   phase);
  if (nameKey) params.set('nameKey', nameKey);

  approvalStatus.forEach(s => params.append('approvalStatus', s));
  workStatus.forEach(s     => params.append('workStatus',     s));

  const url = `/api/projects/${project}/reviews/shots/pivot?${params}`;

  const res = await fetch(url, {
    method: 'GET',
    headers,
    mode: 'cors',
    signal,
  });

  if (res.status === 401) throw new AuthorizationError();
  if (!res.ok) throw new Error('Failed to fetch shots pivot.');

  setNewToken(res);
  return res.json() as Promise<ShotsPivotResponse>;
};
