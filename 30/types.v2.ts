/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    types.ts

  Module Description:
    Type definitions for asset data table components and related structures.

  Details:
    - Defines interfaces and types for assets, table props, sorting, filtering, and related data structures.
    
  Update and Modification History:
    * - 29-10-2025 - SanjayK PSI - Initial creation sorting pagination implementation.
    * - 07-11-2025 - SanjayK PSI - Column visibility toggling implementation.
    * - 20-11-2025 - SanjayK PSI - Fixed typo in filter property names handling.
    * - 24-11-2025 - SanjayK PSI - Added detailed doc comments for functions and types.'

  Functions:
    *-  AssetsDataTableProps: Interface
        - Defines the props for the Assets Data Table component.
    *-  RecordTableHeadProps: Type
        - Defines the props for the table header component.
    *-  Colors: Type
        - Defines color properties for table elements.
    *-  Column: Type
        - Defines properties for individual table columns.
    *-  PageProps: Type
        - Defines pagination properties.
    *-  AssetsPivotResponse: Type
        - Defines the structure of the response for a pivoted assets query.
    *-  ReviewInfo: Type
        - Defines the structure for review information associated with assets.
    *-  Asset: Type
        - Defines the structure of an asset with various status fields.
    *-  FilterProps: Type
        - Defines properties for filtering assets in the table.
    *-  ChipDeleteFunction: Type
        - Defines the function signature for deleting filter chips.
    *-  AssetRowProps: Type
        - Defines the props for individual asset rows in the table.
    *-  LatestAssetComponentDocument: Type
        - Defines the structure for the latest document of an asset component.
    *-  LatestComponent: Type
        - Defines the structure for the latest component information.
    *-  LatestComponents: Type
        - Defines a mapping of latest components by asset.
    *-  LatestAssetComponentDocumentsResponse: Type
        - Defines the response structure for latest asset component documents.
  * ───────────────────────────────────────────────────────────────────────── */
import React from "react";
import { TableCellProps } from "@material-ui/core/TableCell";
import { ReactElement } from "react";
import { Project } from '../types';
import { SelectProps } from "@material-ui/core/Select"; // imported SelectProps for select change handlers

export type SortDir = 'asc' | 'desc' | 'none'; // added sort direction type

export interface AssetsDataTableProps {
  project: Project | null | undefined;
  assets: Asset[]; // updated to Asset type  - Add by PSI
  phaseComponents: { [key: string]: string[] };
  latestComponents: LatestComponents;
  tableFooter?: React.ReactNode; // optionally provided - Add by PSI
  dateTimeFormat: Intl.DateTimeFormat; // optionally provided - Add by PSI

  // sort props already used by the table - Add by PSI
  currentSortKey: string; // ADDED: current sort key - Add by PSI
  currentSortDir: SortDir; // ADDED: current sort direction - Add by PSI
  onSortChange: (sortKey: string) => void; // ADDED: sort change handler - Add by PSI

  // pagination props already used by the table extra
  page: number; // optionally provided - Add by PSI
  rowsPerPage: number; // optionally provided - Add by PSI

  // optionally provided
  hiddenColumns?: Set<string>;

  //  NEW: pass-through filter props from the panel (optional)
  assetNameKey?: string;  // optionally provided - Add by PSI
  approvalStatuses?: string[];  // optionally provided - Add by PSI
  workStatuses?: string[];  // optionally provided - Add by PSI
}

export type RecordTableHeadProps = {
  columns: Column[],
  currentSortKey: string, // ADDED: Required for Table Head to highlight active column - Add by PSI
  currentSortDir: SortDir, // ADDED: Required for Table Head to display arrow direction - Add by PSI
  onSortChange: (sortKey: string) => void, // ADDED: Required for Table Head's click handler - Add by PSI
};

export type Colors = Readonly<{
  lineColor: string,
  backgroundColor: string,
}>;

export type Column = Readonly<{
  id: string,
  label: string,
  colors?: Colors,
  align?: TableCellProps['align'],
  sortable?: boolean, // NEW: indicates if the column is sortable - Add by PSI
  sortKey?: string, // NEW: key to use for sorting when this column is clicked - Add by PSI
}>;

export type PageProps = Readonly<{
  page: number,
  rowsPerPage: number,
}>;

/**
 * Represents the response structure for a pivoted assets query.
 *
 * @property project - The name or identifier of the project.
 * @property root - The root path or identifier for the assets.
 * @property page - The current page number in the paginated response.
 * @property per_page - The number of items per page.
 * @property total - The total number of items available.
 * @property count - The number of items returned in the current response.
 * @property data - An array of asset objects.
 * @property ts - The timestamp when the response was generated.
 */
export type AssetsPivotResponse = {
  project: string,
  root: string,
  page: number,
  per_page: number,
  total: number,
  count: number,
  data: Asset[],
  ts: string,
}

export type ReviewInfo = {
  task_id: string,
  project: string,
  take_path: string,
  root: string,
  relation: string,
  phase: string,
  component: string,
  take: string,
  approval_status: string,
  work_status: string,
  submitted_at_utc: string,
  submitted_user: string,
  modified_at_utc: string,
  id: number,
  groups: string[],
  group_1: string,
  review_comments: ReviewComment[],
};

type ReviewComment = {
  text: string,
  language: string,
  attachments: string[],
  is_translated: boolean,
  need_translation: boolean
};

/**
 * Represents an asset with various status and approval fields for different disciplines.
 *
 * @property root - The root identifier of the asset (previously named 'name').
 * @property project - The project to which the asset belongs.
 * @property group_1 - The group classification of the asset.
 * @property relation - The relation type of the asset.
 *
 * @property mdl_work_status - The work status for the 'mdl' discipline, or null if not set.
 * @property mdl_approval_status - The approval status for the 'mdl' discipline, or null if not set.
 * @property mdl_submitted_at_utc - The UTC timestamp when 'mdl' was submitted, or null if not set.
 *
 * @property rig_work_status - The work status for the 'rig' discipline, or null if not set.
 * @property rig_approval_status - The approval status for the 'rig' discipline, or null if not set.
 * @property rig_submitted_at_utc - The UTC timestamp when 'rig' was submitted, or null if not set.
 *
 * @property bld_work_status - The work status for the 'bld' discipline, or null if not set.
 * @property bld_approval_status - The approval status for the 'bld' discipline, or null if not set.
 * @property bld_submitted_at_utc - The UTC timestamp when 'bld' was submitted, or null if not set.
 *
 * @property dsn_work_status - The work status for the 'dsn' discipline, or null if not set.
 * @property dsn_approval_status - The approval status for the 'dsn' discipline, or null if not set.
 * @property dsn_submitted_at_utc - The UTC timestamp when 'dsn' was submitted, or null if not set.
 *
 * @property ldv_work_status - The work status for the 'ldv' discipline, or null if not set.
 * @property ldv_approval_status - The approval status for the 'ldv' discipline, or null if not set.
 * @property ldv_submitted_at_utc - The UTC timestamp when 'ldv' was submitted, or null if not set.
 */
export type Asset = Readonly<{
  root: string, 
  project: string,
  group_1: string, 
  relation: string,

  mdl_work_status: string | null,
  mdl_approval_status: string | null,
  mdl_submitted_at_utc: string | null,

  rig_work_status: string | null,
  rig_approval_status: string | null,
  rig_submitted_at_utc: string | null,

  bld_work_status: string | null,
  bld_approval_status: string | null,
  bld_submitted_at_utc: string | null,

  dsn_work_status: string | null,
  dsn_approval_status: string | null,
  dsn_submitted_at_utc: string | null,

  ldv_work_status: string | null,
  ldv_approval_status: string | null,
  ldv_submitted_at_utc: string | null,

  // Group Category field
  leaf_group_name?: string | null,
  group_category_path?: string | null,
  top_group_node?: string | null,
}>;

export type FilterProps = Readonly<{
  assetNameKey: string,
  applovalStatues: string[],
  workStatues: string[],
  
  /* New select and change handler props - Add by PSI */
  selectPhasePriority: string, // added phase priority select value - Add by PSI
  selectApprovalStatus: string, // added approval status select value - Add by PSI
  selectWorkStatus: string, // added work status select value - Add by PSI
  onPhasePriorityChange: SelectProps['onChange'], // added phase priority change handler - Add by PSI
  onApprovalStatusChange: SelectProps['onChange'], // added approval status change handler - Add by PSI
  onWorkStatusChange: SelectProps['onChange'], // added work status change handler - Add by PSI
}>;

export type ChipDeleteFunction = (value: string) => void;

export type AssetRowProps = Readonly<{
  asset: Asset,
  thumbnails: { [key: string]: string },
  phaseComponents: { [key: string]: string[] },
  latestComponents: LatestComponents,
  dateTimeFormat: Intl.DateTimeFormat,
  isLastRow: boolean,
}>;

export type LatestAssetComponentDocument = Readonly<{
  component: string,
  groups: string[],
  phase: string,
  submitted_at_utc: string,
}>;

type LatestComponent = Readonly<{
  component: string,
  latest_document: LatestAssetComponentDocument,
}>

export type LatestComponents = {
  [key: string]: LatestComponent[],
};

export type LatestAssetComponentDocumentsResponse = Readonly<{
  component: string,
  latest_document: LatestAssetComponentDocument,
}>;

/* ──────────────────────────────────────────────────────────────────────────
  End of Module
  ───────────────────────────────────────────────────────────────────────── */

export type PivotGroup = Readonly<{
  top_group_node: string | null;
  /** Items included in this response (may be paged) */
  items: Asset[];
  /** Optional total items in this group across all pages (if backend provides it) */
  total_count?: number;
}>;