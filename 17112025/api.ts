// api.ts
import { Project } from '../types'; // whatever your project type is

export type AssetPivot = {
  root: string;
  project: string;
  group_1: string;
  relation: string;

  mdl_work_status?: string | null;
  mdl_approval_status?: string | null;
  mdl_submitted_at_utc?: string | null;

  rig_work_status?: string | null;
  rig_approval_status?: string | null;
  rig_submitted_at_utc?: string | null;

  bld_work_status?: string | null;
  bld_approval_status?: string | null;
  bld_submitted_at_utc?: string | null;

  dsn_work_status?: string | null;
  dsn_approval_status?: string | null;
  dsn_submitted_at_utc?: string | null;

  ldv_work_status?: string | null;
  ldv_approval_status?: string | null;
  ldv_submitted_at_utc?: string | null;
};

export type AssetsPivotResponse = {
  assets: AssetPivot[];
  total: number;
  page: number;
  per_page: number;
  sort: string;
  dir: string;
};

export async function fetchAssetsPivot(
  project: Project | null | undefined,
  page: number,
  rowsPerPage: number,
  sortKey: string,
  sortDir: 'asc' | 'desc',
  phase: string,                // mdl|rig|bld|dsn|ldv|none
  nameKey: string,
  approvalStatuses: string[],
  workStatuses: string[],
): Promise<AssetsPivotResponse> {
  if (!project) {
    return { assets: [], total: 0, page: 0, per_page: rowsPerPage, sort: sortKey, dir: sortDir };
  }

  const params = new URLSearchParams();

  params.set('page', String(page + 1));           // backend is 1-based
  params.set('per_page', String(rowsPerPage));
  params.set('sort', sortKey);
  params.set('dir', sortDir.toUpperCase());
  params.set('root', 'assets');                  // or make this dynamic

  if (phase && phase !== 'none') {
    params.set('phase', phase);
  }

  if (nameKey && nameKey.trim() !== '') {
    params.set('name', nameKey.trim());
  }

  // approval_status=val1&approval_status=val2...
  approvalStatuses
    .filter(s => s && s.trim() !== '')
    .forEach(s => params.append('approval_status', s));

  workStatuses
    .filter(s => s && s.trim() !== '')
    .forEach(s => params.append('work_status', s));

  const res = await fetch(
    `/api/projects/${encodeURIComponent(project.key_name)}/reviews/assets/pivot?` +
      params.toString(),
    { method: 'GET' },
  );

  if (!res.ok) {
    throw new Error(`fetchAssetsPivot failed: ${res.status}`);
  }

  return res.json();
}
