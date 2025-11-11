export const fetchAssetsPivot = async (
  project: string,
  page: number,
  rowsPerPage: number,
  sortKey: string,
  sortDir: string,
  phase: string,
  signal?: AbortSignal | null,
  nameKey?: string,
  workStatuses: string[] = [],
  apprStatuses: string[] = [],
): Promise<AssetsPivotResponse> => {
  const headers = getAuthHeader();
  let url: string = `/api/projects/${encodeURIComponent(project)}/reviews/assets/pivot`;

  const params = new URLSearchParams();
  params.set('per_page', String(rowsPerPage));
  params.set('page', String(page + 1));
  if (sortKey) params.set('sort', sortKey);
  if (sortDir) params.set('dir', sortDir.toUpperCase());
  if (phase)   params.set('phase', phase);

  if (nameKey && nameKey.trim()) {
    params.set('name', nameKey.trim());
    params.set('name_mode', 'prefix'); // or 'exact'
  }
  if (workStatuses.length) params.set('work', workStatuses.join(','));
  if (apprStatuses.length) params.set('appr', apprStatuses.join(','));

  url += `?${params.toString()}`;

  const res = await fetch(url, { method: 'GET', headers, mode: 'cors', signal: signal || undefined });
  if (res.status === 401) throw new AuthorizationError();
  if (!res.ok) throw new Error('Failed to fetch pivoted assets.');
  setNewToken(res);
  return await res.json();
};
