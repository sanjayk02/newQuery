import { ReviewShotsPivotResponse } from './types';



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
  phases    = [],
  statuses  = [],
  signal,
}: ReviewShotsPivotParams): Promise<ReviewShotsPivotResponse> => {
  const headers = getAuthHeader();
  const params = new URLSearchParams();

  params.set('page',      String(page));
  params.set('perPage',   String(perPage));
  params.set('orderKey',  orderKey);
  params.set('direction', direction);

  phases.forEach(p   => params.append('phase',  p));   // repeatable -> c.QueryArray("phase")
  statuses.forEach(s => params.append('status', s));   // repeatable -> c.QueryArray("status")

  const url = `/api/projects/${project}/reviews/shots/checkPivot?${params.toString()}`;

  const res = await fetch(url, { method: 'GET', headers, mode: 'cors', signal });
  if (res.status === 401) throw new AuthorizationError();
  if (!res.ok) {
    const errorText = await res.text();
    console.error('fetchReviewShotsPivot error:', errorText);
    throw new Error('Failed to fetch review shots pivot.');
  }
  setNewToken(res);
  const data: ReviewShotsPivotResponse = await res.json();
  return data;
};
