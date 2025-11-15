// hooks.ts
import { useQuery } from "react-query";
import { fetchAssetsPivot, AssetPivot } from "./api";

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
  const projectKeyName = project?.key_name;

  const queryKey = [
    "assetsPivot",
    projectKeyName,
    page,
    rowsPerPage,
    sortKey,
    sortDir,
    phase,
    assetNameKey,
    approvalStatuses.join(","),
    workStatuses.join(","),
  ];

  const { data, isLoading, isError, error } = useQuery(
    queryKey,
    () =>
      fetchAssetsPivot(
        projectKeyName,
        page,
        rowsPerPage,
        sortKey,
        sortDir,
        phase,
        assetNameKey,
        approvalStatuses,
        workStatuses,
      ),
    {
      enabled: !!projectKeyName,
      keepPreviousData: true,
    },
  );

  return {
    assets: (data?.assets ?? []) as AssetPivot[],
    total: data?.total ?? 0,
    loading: isLoading,
    error: isError ? error : null,
  };
}
