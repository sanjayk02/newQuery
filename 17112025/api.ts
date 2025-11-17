export const fetchAssetsPivot = async (
  project: string,
  page: number,
  rowsPerPage: number,
  sortKey: string,
  sortDir: string,   // we'll receive 'asc' | 'desc'
  phase: string,     // 'mdl' | 'rig' | 'bld' | 'dsn' | 'ldv' | 'none' | ''
  assetNameKey: string,
  approvalStatuses: string[],
  workStatuses: string[],
  signal?: AbortSignal | null,
): Promise<AssetsPivotResponse> => {
  const headers = getAuthHeader();
  let url = `/api/projects/${encodeURIComponent(project)}/reviews/assets/pivot`;

  const params = new URLSearchParams();
  params.set('per_page', String(rowsPerPage));
  params.set('page', String(page + 1));

  if (sortKey) {
    params.set('sort', sortKey);
  }

  const dirLower = (sortDir || '').toLowerCase();
  if (dirLower === 'asc' || dirLower === 'desc') {
    params.set('dir', dirLower.toUpperCase());
  }

  if (phase && phase !== 'none') {
    params.set('phase', phase);
  }

  const trimmed = (typeof assetNameKey === 'string' ? assetNameKey : '').trim();
  if (trimmed) {
    params.set('name', trimmed);
  }

  if (Array.isArray(workStatuses)) {
    workStatuses
      .map(s => s && s.trim())
      .filter(Boolean)
      .forEach(s => params.append('work_status', s as string));
  }

  if (Array.isArray(approvalStatuses)) {
    approvalStatuses
      .map(s => s && s.trim())
      .filter(Boolean)
      .forEach(s => params.append('approval_status', s as string));
  }

  url += `?${params.toString()}`;

  const res = await fetch(url, {
    method: 'GET',
    headers,
    mode: 'cors',
    signal: signal || undefined,
  });

  if (res.status === 401) throw new AuthorizationError();
  if (!res.ok) throw new Error('Failed to fetch pivoted assets.');

  setNewToken(res);
  const json = (await res.json()) as AssetsPivotResponse;
  return json;
};
