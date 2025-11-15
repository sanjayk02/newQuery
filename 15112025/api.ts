// api.ts
export type AssetPivot = {
  root: string;
  project: string;
  group_1: string;
  relation: string;

  mdl_work_status?: string | null;
  mdl_appr_status?: string | null;
  mdl_submitted_at?: string | null;

  rig_work_status?: string | null;
  rig_appr_status?: string | null;
  rig_submitted_at?: string | null;

  bld_work_status?: string | null;
  bld_appr_status?: string | null;
  bld_submitted_at?: string | null;

  dsn_work_status?: string | null;
  dsn_appr_status?: string | null;
  dsn_submitted_at?: string | null;

  ldv_work_status?: string | null;
  ldv_appr_status?: string | null;
  ldv_submitted_at?: string | null;
};

export type AssetsPivotResponse = {
  assets: AssetPivot[];
  total: number;
  page: number;
  per_page: number;
  sort: string;
  dir: "asc" | "desc";
  phase: string;
};

export async function fetchAssetsPivot(
  projectKeyName: string | undefined,
  page: number,                 // 0-based from MUI
  perPage: number,
  sortKey: string,
  sortDir: "asc" | "desc",
  phase: string,                // "none" | "mdl" | ...
  assetNameKey: string,
  approvalStatuses: string[],
  workStatuses: string[],
): Promise<AssetsPivotResponse> {
  if (!projectKeyName) {
    return { assets: [], total: 0, page: 1, per_page: perPage, sort: sortKey, dir: sortDir, phase };
  }

  const params = new URLSearchParams();

  // backend expects 1-based page index
  params.set("page", String(page + 1));
  params.set("per_page", String(perPage));
  params.set("sort", sortKey);
  params.set("dir", sortDir);
  params.set("phase", phase || "none");

  if (assetNameKey.trim() !== "") {
    params.set("name", assetNameKey.trim());
  }
  if (approvalStatuses.length > 0) {
    params.set("appr", approvalStatuses.join(","));
  }
  if (workStatuses.length > 0) {
    params.set("work", workStatuses.join(","));
  }

  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectKeyName)}/reviews/assets/pivot?${params.toString()}`,
    { method: "GET" },
  );

  if (!res.ok) {
    throw new Error(`fetchAssetsPivot failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as AssetsPivotResponse;
  // guarantee defaults
  return {
    assets: data.assets ?? [],
    total: data.total ?? 0,
    page: data.page ?? page + 1,
    per_page: data.per_page ?? perPage,
    sort: data.sort ?? sortKey,
    dir: (data.dir as "asc" | "desc") ?? sortDir,
    phase: data.phase ?? phase,
  };
}
