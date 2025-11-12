// types.ts

export type SortDir = 'asc' | 'desc' | 'none';

// …

export interface AssetsDataTableProps {
  project: Project | null | undefined;
  assets: AssetPhaseSummary[];
  tableFooter?: React.ReactNode;
  dateTimeFormat: Intl.DateTimeFormat;

  // sort props already used by the table
  currentSortKey: string;
  currentSortDir: SortDir;
  onSortChange: (sortKey: string) => void;

  // optionally provided
  hiddenColumns?: Set<string>;

  // 🔽 NEW: pass-through filter props from the panel (optional)
  assetNameKey?: string;
  approvalStatuses?: string[];
  workStatuses?: string[];
}
