// hooks.ts
import { useQuery } from "react-query";
import { fetchAssetsPivot, AssetPivot, AssetsPivotResponse } from "./api";

export function useFetchAssetsPivot(
  project: { key_name: string } | null | undefined,
  page: number,
  rowsPerPage: number,
  sortKey: string,
  sortDir: "asc" | "desc",
  phase: string,
  assetNameKey: string,
  approvalStatuses: string[],
  workStatuses: string[],
) {
  // ✋ NO optional chaining here:
  let projectKeyName: string | undefined;
  if (project && project.key_name) {
    projectKeyName = project.key_name;
  }

  const queryKey = [
    "assetsPivot",
    projectKeyName || "",
    page,
    rowsPerPage,
    sortKey,
    sortDir,
    phase,
    assetNameKey,
    approvalStatuses.join(","),
    workStatuses.join(","),
  ];

  const queryFn = function () {
    // guard in case projectKeyName is undefined
    if (!projectKeyName) {
      // match the shape of real API response so callers are safe
      const empty: AssetsPivotResponse = {
        assets: [],
        total: 0,
        page: page + 1,
        per_page: rowsPerPage,
        sort: sortKey,
        dir: sortDir,
        phase: phase,
      };
      return Promise.resolve(empty);
    }

    return fetchAssetsPivot(
      projectKeyName,
      page,
      rowsPerPage,
      sortKey,
      sortDir,
      phase,
      assetNameKey,
      approvalStatuses,
      workStatuses,
    );
  };

  const { data, isLoading, isError, error } = useQuery(
    queryKey,
    queryFn,
    {
      enabled: !!projectKeyName,
      keepPreviousData: true,
    },
  );

  // ✋ NO data?.assets etc – use plain checks
  let assets: AssetPivot[] = [];
  let total = 0;
  if (data) {
    if (data.assets) {
      assets = data.assets;
    }
    if (typeof data.total === "number") {
      total = data.total;
    }
  }

  return {
    assets: assets,
    total: total,
    loading: isLoading,
    error: isError ? error : null,
  };
}
