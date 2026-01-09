/* _________________________________________________________________________________
  
  Module Name:
  AssetsDataTable.tsx
  
  Module Description:
  React component that renders a data table displaying asset information for a project.
  
  Details:
  - Fetches and displays asset thumbnails.
  - Supports sorting by various asset attributes.
  - Allows hiding/showing of specific columns.
  - Compact mode for minimal column display.

  * Update and Modification History:
    * - 29-10-2025 - SanjayK PSI - Initial creation sorting pagination implementation.
    * - 07-11-2025 - SanjayK PSI - Column visibility toggling implementation.
    * - 20-11-2025 - SanjayK PSI - Fixed typo in filter property names handling.
    * - 24-11-2025 - SanjayK PSI - Added detailed doc comments for functions and types.
    * 
  Function:
    * - AssetsDataTable: Main component rendering the assets data table.
    * - RecordTableHead: Renders the table header with sortable columns.
    * - AssetRow: Renders individual rows for each asset.
    * - Styled components for consistent theming.
    * - MultIineTooltipTableCell: Table cell with multi-line tooltip support.
    * - Constants for asset phases, approval statuses, and work statuses.
    * - Column definitions for the data table.
    * - NON_FIXED_IDS: Array of column IDs excluding fixed columns.
    * - isOnlyFixedVisible: Utility to check if only fixed columns are visible.
    * - TooltipTableCellProps: Props for the MultiLineTooltipTableCell component.
    * - Status: Type defining display name and color for statuses.
    * - Columns: Configuration for the data table columns.
    * - ASSET_PHASES, APPROVAL_STATUS, WORK_STATUS: Mappings for phases and statuses.
    * - getPhaseData: Utility to extract phase-related data from an asset.
    * - isHidden: Utility to check if a column is hidden.
    * - RecordTableHead: Renders the table header with sortable columns
  * 
  ___________________________________________________________________________________ */
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  TableSortLabel,
} from "@material-ui/core";
import {
  AssetRowProps,
  AssetsDataTableProps,
  Colors,
  Column,
  RecordTableHeadProps,
  SortDir,
  Asset,
} from "./types";
import { useFetchAssetThumbnails } from "./hooks";

const ASSET_PHASES: { [key: string]: Colors } = {
  mdl: {
    lineColor: '#3295fd',
    backgroundColor: '#354d68',
  },
  rig: {
    lineColor: '#c061fd',
    backgroundColor: '#5e3568',
  },
  bld: {
    lineColor: '#fc2f8c',
    backgroundColor: '#5a0028',
  },
  dsn: {
    lineColor: '#98f2fb',
    backgroundColor: '#045660',
  },
  ldv: {
    lineColor: '#fe5cff',
    backgroundColor: '#683566',
  },
};

type Status = Readonly<{
  displayName: string,
  color: string,
}>;

/** ============================================================================================================
 * Props for the local AssetsDataTable component, extending the base `AssetsDataTableProps`.
 *
 * @property currentSortKey - The key of the column currently used for sorting.
 * @property currentSortDir - The current sort direction (`asc` or `desc`).
 * @property onSortChange - Callback invoked when the sort key changes.
 * @property hiddenColumns - Optional set of column keys to hide from the table.
 * @property assetNameKey - The key used to identify the asset name for filtering.
 * @property approvalStatuses - List of approval statuses available for filtering.
 * @property workStatuses - List of work statuses available for filtering.
 =============================================================================================================*/
const APPROVAL_STATUS: { [key: string]: Status } = {
  check: {
    displayName: 'Check',
    color: '#ca25ed',
  },
  clientReview: {
    displayName: 'Client Review',
    color: '#005fbd',
  },
  dirReview: {
    displayName: 'Dir Review',
    color: '#007fff',
  },
  epdReview: {
    displayName: 'EPD Review',
    color: '#4fa7ff',
  },
  clientOnHold: {
    displayName: 'Client On Hold',
    color: '#d69b00',
  },
  dirOnHold: {
    displayName: 'Dir On Hold',
    color: '#ffcc00',
  },
  epdOnHold: {
    displayName: 'EPD On Hold',
    color: '#ffdd55',
  },
  execRetake: {
    displayName: 'Exec Retake',
    color: '#a60000',
  },
  clientRetake: {
    displayName: 'Client Retake',
    color: '#c60000',
  },
  dirRetake: {
    displayName: 'Dir Retake',
    color: '#ff0000',
  },
  epdRetake: {
    displayName: 'EPD Retake',
    color: '#ff4f4f',
  },
  clientApproved: {
    displayName: 'Client Approved',
    color: '#1d7c39',
  },
  dirApproved: {
    displayName: 'Dir Approved',
    color: '#27ab4f',
  },
  epdApproved: {
    displayName: 'EPD Approved',
    color: '#5cda82',
  },
  other: {
    displayName: 'Other',
    color: '#9a9a9a',
  },
  omit: {
    displayName: 'Omit',
    color: '#646464',
  },
  approved: {
    displayName: 'Approved',
    color: '#32cd32',
  },
  review: {
    displayName: 'Review',
    color: '#ffa500',
  },
};

const WORK_STATUS: { [key: string]: Status } = {
  check: { displayName: "Check", color: "#e287f5" }, // <--- ADDED/CONFIRMED FOR DSN FIX
  cgsvOnHold: { displayName: "CGSV On Hold", color: "#ffdd55" },
  svOnHold: { displayName: "SV On Hold", color: "#ffe373" },
  leadOnHold: { displayName: "Lead On Hold", color: "#fff04f" },
  cgsvRetake: { displayName: "CGSV Retake", color: "#ff4f4f" },
  svRetake: { displayName: "SV Retake", color: "#ff8080" },
  leadRetake: { displayName: "Lead Retake", color: "#ffbbbb" },
  cgsvApproved: { displayName: "CGSV Approved", color: "#5cda82" },
  svApproved: { displayName: "SV Approved", color: "#83e29f" },
  leadApproved: { displayName: "Lead Approved", color: "#b9eec9" },
  svOther: { displayName: "SV Other", color: "#9a9a9a" },
  leadOther: { displayName: "Lead Other", color: "#dbdbdb" },
  review: { displayName: "Review", color: "#ffa500" },
  inProgress: { displayName: "In Progress", color: "#00bfff" },
  notStarted: { displayName: "Not Started", color: "#d3d3d3" },
  approved: { displayName: "Approved", color: "#32cd32" },
};


/** =============================================================================================================
 * Defines the columns configuration for the Assets Data Table.
 *
 * Each column object specifies:
 * - `id`: Unique identifier for the column, corresponding to the data field.
 * - `label`: Display name for the column header.
 * - `sortable` (optional): Indicates if the column can be sorted.
 * - `sortKey` (optional): Key used for sorting the column data.
 * - `colors` (optional): Color mapping for status columns, based on asset phases.
 *
 * The columns cover various asset phases (MDL, RIG, BLD, DSN, LDV) and their respective work, approval, and submission statuses,
 * as well as general asset information such as thumbnail, name, and relation.
 ================================================================================================================*/
const columns: Column[] = [
  { id: "thumbnail", label: "Thumbnail" },
  { id: "group_1_name", label: "Name", sortable: true, sortKey: "group_1" },

  { id: "mdl_work_status", label: "MDL WORK", colors: ASSET_PHASES.mdl, sortable: true, sortKey: "mdl_work" },
  { id: "mdl_approval_status", label: "MDL APPR", colors: ASSET_PHASES.mdl, sortable: true, sortKey: "mdl_appr" },
  { id: "mdl_submitted_at", label: "MDL Submitted At", colors: ASSET_PHASES.mdl, sortable: true, sortKey: "mdl_submitted" },

  { id: "rig_work_status", label: "RIG WORK", colors: ASSET_PHASES.rig, sortable: true, sortKey: "rig_work" },
  { id: "rig_approval_status", label: "RIG APPR", colors: ASSET_PHASES.rig, sortable: true, sortKey: "rig_appr" },
  { id: "rig_submitted_at", label: "RIG Submitted At", colors: ASSET_PHASES.rig, sortable: true, sortKey: "rig_submitted" },

  { id: "bld_work_status", label: "BLD WORK", colors: ASSET_PHASES.bld, sortable: true, sortKey: "bld_work" },
  { id: "bld_approval_status", label: "BLD APPR", colors: ASSET_PHASES.bld, sortable: true, sortKey: "bld_appr" },
  { id: "bld_submitted_at", label: "BLD Submitted At", colors: ASSET_PHASES.bld, sortable: true, sortKey: "bld_submitted" },

  { id: "dsn_work_status", label: "DSN WORK", colors: ASSET_PHASES.dsn, sortable: true, sortKey: "dsn_work" },
  { id: "dsn_approval_status", label: "DSN APPR", colors: ASSET_PHASES.dsn, sortable: true, sortKey: "dsn_appr" },
  { id: "dsn_submitted_at", label: "DSN Submitted At", colors: ASSET_PHASES.dsn, sortable: true, sortKey: "dsn_submitted" },

  { id: "ldv_work_status", label: "LDV WORK", colors: ASSET_PHASES.ldv, sortable: true, sortKey: "ldv_work" },
  { id: "ldv_approval_status", label: "LDV APPR", colors: ASSET_PHASES.ldv, sortable: true, sortKey: "ldv_appr" },
  { id: "ldv_submitted_at", label: "LDV Submitted At", colors: ASSET_PHASES.ldv, sortable: true, sortKey: "ldv_submitted" },

  { id: "relation", label: "Relation", sortable: true, sortKey: "relation" },
];


/**=============================================================================================================
 * NON_FIXED_IDS
 * An array of column IDs excluding "thumbnail" and "group_1_name".
 * 
 * Iterates over the `columns` array, extracts the `id` property from each column,
 * and filters out the IDs "thumbnail" and "group_1_name".
 *
 * @remarks
 * Useful for identifying columns that are not fixed or special-purpose.
 *
 * @example
 * // Given columns = [{ id: "name" }, { id: "thumbnail" }, { id: "group_1_name" }]
 * // NON_FIXED_IDS will be ["name"]
 ================================================================================================================*/
const NON_FIXED_IDS = columns.map(c => c.id).filter(id => id !== "thumbnail" && id !== "group_1_name");
const isOnlyFixedVisible = (hidden: Set<string>) => NON_FIXED_IDS.every(id => hidden.has(id));


type TooltipTableCellProps = {
  tooltipText: string;
  status: Status | undefined;
  leftBorderStyle: string;
  rightBorderStyle: string;
  bottomBorderStyle: string;
};

const MultiLineTooltipTableCell: React.FC<TooltipTableCellProps> = ({
  tooltipText, status, leftBorderStyle, rightBorderStyle, bottomBorderStyle = "none",
}) => {
  const [open, setOpen] = React.useState(false);
  const hasTooltipText = tooltipText && tooltipText.trim().length > 0;
  const statusText = status ? status.displayName : "-";

  return (
    <TableCell
      style={{
        color: status ? status.color : "",
        fontStyle: tooltipText === "" ? "normal" : "oblique",
        borderLeft: leftBorderStyle,
        borderRight: rightBorderStyle,
        borderBottom: bottomBorderStyle,
      }}
      onClick={hasTooltipText ? () => setOpen(true) : undefined}
    >
      {hasTooltipText ? (
        <Tooltip
          title={<div style={{ fontSize: "0.8rem", whiteSpace: "pre-wrap" }}>{tooltipText}</div>}
          onClose={() => setOpen(false)}
          open={open}
          arrow
        >
          <span>{statusText}</span>
        </Tooltip>
      ) : (
        <span>{statusText}</span>
      )}
    </TableCell>
  );
};
           
/**=============================================================================================================
 * RecordTableHead (borders + compact widths)
 * Renders the table header row for the asset data table, supporting sortable columns and phase-based styling.
 *
 * @param columns - Array of column definitions, each describing a header cell.
 * @param onSortChange - Callback invoked when a sortable column header is clicked, receiving the sort key.
 * @param currentSortKey - The currently active sort key.
 * @param currentSortDir - The current sort direction ("asc", "desc", or "none").
 * @param headerCellStylesById - Optional mapping of column IDs to custom CSS styles for header cells.
 * @param phase - (internal) The current asset phase being processed for styling purposes.
 * @return A React component rendering the table header with appropriate styles and sorting functionality.
 *
 * The component visually groups columns by phase (e.g., "mdl", "rig", etc.) and applies colored borders and backgrounds
 * based on the phase and column configuration. Sortable columns display a custom sort icon and trigger sorting when clicked.
 ==================================================================================================================*/
const RecordTableHead: React.FC<RecordTableHeadProps & {
  onSortChange: (sortKey: string) => void;
  currentSortKey: string;
  currentSortDir: SortDir;
  headerCellStylesById?: Record<string, React.CSSProperties>;
}> = ({
  columns, onSortChange, currentSortKey, currentSortDir, headerCellStylesById = {},
}) => {
  const getSortDir = (id: string, activeKey: string, activeDir: SortDir): SortDir =>
    activeKey === id ? activeDir : "none";

  const createSortHandler = (id: string) => () => onSortChange(id);

  return (
    <TableHead>
      <TableRow>
        {columns.map((column) => {
          // Determine "first/last visible" within a phase to draw borders
          const phase = ["mdl", "rig", "bld", "dsn", "ldv"].find(p => column.id.startsWith(p));
          const inPhaseIds = phase
            ? [`${phase}_work_status`, `${phase}_approval_status`, `${phase}_submitted_at`]
                .filter(id => columns.some(c => c.id === id))
            : [];
          const firstId = inPhaseIds[0];
          const lastId  = inPhaseIds[inPhaseIds.length - 1];

          const hasPhase = Boolean(phase && column.colors);
          const rail = hasPhase ? `solid 3px ${column.colors!.lineColor}` : "none";

          const sortKey = column.sortKey || column.id;
          const sortDir = getSortDir(sortKey, currentSortKey, currentSortDir);

          return (
            <TableCell
              key={column.id}
              style={{
                backgroundColor: column.colors ? column.colors.backgroundColor : "none",
                borderTop: hasPhase ? rail : "none",
                borderLeft: hasPhase && firstId === column.id ? rail : "none",
                borderRight: hasPhase && lastId  === column.id ? rail : "none",
                ...(headerCellStylesById[column.id] || {}),
              }}
            >
              {column.sortable ? (
                <TableSortLabel
                  active={sortDir !== "none"}
                  hideSortIcon
                  direction={sortDir === "desc" ? "desc" : "asc"}
                  onClick={createSortHandler(sortKey)}
                  IconComponent={() => (
                    <span style={{ fontSize: 16, fontWeight: 750, lineHeight: "24px", marginLeft: 10, userSelect: "none" }}>
                      {sortDir === "desc" ? "▼" : "▲"}
                    </span>
                  )}
                >
                  {column.label}
                </TableSortLabel>
              ) : (
                column.label
              )}
            </TableCell>
          );
        })}
      </TableRow>
    </TableHead>
  );
};

/**=============================================================================================================
 * AssetRow
 * Renders a single row in the assets data table, displaying asset information and phase statuses.
 *
 * @component
 * @param asset - The asset data object containing phase summaries and identifying fields.
 * @param thumbnails - A mapping of asset keys to thumbnail image URLs.
 * @param dateTimeFormat - An Intl.DateTimeFormat instance for formatting submission dates.
 * @param isLastRow - Indicates if this row is the last in the table (for border styling).
 * @param hiddenColumns - A set of column IDs to hide from display.
 * @param compact - If true, renders the row in a compact layout.
 *
 * @returns The rendered table row for the asset, with conditional columns and phase status cells.
 =================================================================================================================*/
const AssetRow: React.FC<AssetRowProps & { hiddenColumns: Set<string>; compact: boolean }> = ({
  asset, thumbnails, dateTimeFormat, isLastRow, hiddenColumns, compact,
}) => {
  const isHidden = (id: string) => hiddenColumns.has(id);

  const getPhaseData = (phase: string) => {
    const workStatusKey     = `${phase}_work_status` as keyof Asset;
    const approvalStatusKey = `${phase}_approval_status` as keyof Asset;
    const submittedAtKey    = `${phase}_submitted_at_utc` as keyof Asset;
    const utcKey            = `${phase}_submitted_at_at` as keyof Asset;

    const workStatusValue     = asset[workStatusKey];
    const approvalStatusValue = asset[approvalStatusKey];
    const submittedAtValue    = asset[submittedAtKey];

    // Status lookup with generic fallback if key is not found (FIXED FOR DSN)
    let workStatus: Status | undefined = undefined;
    if (workStatusValue) {
        const raw = String(workStatusValue);
        workStatus = WORK_STATUS[raw] || 
        WORK_STATUS[raw.toLowerCase()] || 
        WORK_STATUS[raw.charAt(0).toLowerCase() + raw.slice(1)];

        
        // Use a generic status if the key is not found
        if (!workStatus) {
            workStatus = WORK_STATUS.svOther; // Fallback
        }
    }
    
    let approvalStatus: Status | undefined = undefined;
    if (approvalStatusValue) {
        const raw = String(approvalStatusValue);
        approvalStatus = APPROVAL_STATUS[raw] || 
        APPROVAL_STATUS[raw.toLowerCase()] || 
        APPROVAL_STATUS[raw.charAt(0).toLowerCase() + raw.slice(1)];

        // Use a generic status if the key is not found
        if (!approvalStatus) {
            approvalStatus = APPROVAL_STATUS.other; // Fallback
        }
    }

    const submittedAt = submittedAtValue ? new Date(submittedAtValue as string) : null;
    const localTimeText = submittedAt ? dateTimeFormat.format(submittedAt) : "-";

    return { workStatus, approvalStatus, localTimeText, tooltipText: "" };
  };

  return (
    <TableRow>
      {!isHidden("thumbnail") && (
        <TableCell style={compact ? { width: 140, minWidth: 140, maxWidth: 140 } : undefined}>
          {thumbnails[`${asset.group_1}-${asset.relation}`] ? (
            <img
              src={thumbnails[`${asset.group_1}-${asset.relation}`]}
              alt={`${asset.group_1} thumbnail`}
              style={{ width: "100px", height: "auto" }}
            />
          ) : (
            <span>No Thumbnail</span>
          )}
        </TableCell>
      )}

      {/* NAME */}
      {!isHidden("group_1_name") && (
        <TableCell style={compact ? { minWidth: 220 } : undefined}>{asset.group_1}</TableCell>
      )}

      {/* PHASES */}
      {(Object.entries(ASSET_PHASES) as Array<[string, { lineColor: string }]>).map(
          ([phase, { lineColor }]) => {
            const ids = {
              work: `${phase}_work_status`,
              appr: `${phase}_approval_status`,
              subm: `${phase}_submitted_at`,
            };

            const visibleIds = [
              !isHidden(ids.work) ? ids.work : null,
              !isHidden(ids.appr) ? ids.appr : null,
              !isHidden(ids.subm) ? ids.subm : null,
            ].filter(Boolean) as string[];

            if (visibleIds.length === 0) return null;

            const firstId = visibleIds[0];
            const lastId  = visibleIds[visibleIds.length - 1];
            const rail = `solid 3px ${lineColor}`;

            const { workStatus, approvalStatus, localTimeText, tooltipText } = getPhaseData(phase);

            return (
              <React.Fragment key={`${asset.group_1}-${asset.relation}-${phase}`}>
                {/* WORK */}
                {!isHidden(ids.work) && (
                  <MultiLineTooltipTableCell
                    tooltipText={tooltipText}
                    status={workStatus}
                    leftBorderStyle={firstId === ids.work ? rail : "none"}
                    rightBorderStyle={lastId  === ids.work ? rail : "none"}
                    bottomBorderStyle={isLastRow ? rail : "none"}
                  />
                )}

                {/* APPR */}
                {!isHidden(ids.appr) && (
                  <MultiLineTooltipTableCell
                    tooltipText={tooltipText}
                    status={approvalStatus}
                    leftBorderStyle={firstId === ids.appr ? rail : "none"}
                    rightBorderStyle={lastId  === ids.appr ? rail : "none"}
                    bottomBorderStyle={isLastRow ? rail : "none"}
                  />
                )}

                {/* SUBMITTED */}
                {!isHidden(ids.subm) && (
                  <TableCell
                    style={{
                      borderLeft: firstId === ids.subm ? rail : "none",
                      borderRight: lastId === ids.subm ? rail : "none",
                      borderBottom: isLastRow ? rail : "none",
                    }}
                  >
                    {localTimeText}
                  </TableCell>
                )}
              </React.Fragment>
            );
          }
        )}

      {/* RELATION (kept to non-compact mode for neat two-column compact) */}
      {!isHidden("relation") && !compact && <TableCell>{asset.relation}</TableCell>}
    </TableRow>
  );
};

/** =============================================================================================================
 * AssetsDataTable
 * Renders a data table displaying a list of assets for a given project.
 *
 * @param project - The current project context. If not provided, the table is not rendered.
 * @param assets - Array of asset objects to display in the table.
 * @param tableFooter - Optional React node to render as the table footer.
 * @param dateTimeFormat - Optional date/time format string for displaying date fields.
 * @param onSortChange - Callback function invoked when the sort key or direction changes.
 * @param currentSortKey - The current key by which the table is sorted.
 * @param currentSortDir - The current sort direction ("asc" or "desc").
 * @param hiddenColumns - Set of column IDs to hide from the table. Defaults to an empty set.
 * @param assetNameKey - (Optional) Key used to identify the asset name column for filtering.
 * @param approvalStatuses - (Optional) List of approval statuses for filtering or display.
 * @param workStatuses - (Optional) List of work statuses for filtering or display.
 *
 * @returns A React functional component rendering the assets data table, or null if no project is provided.
 =================================================================================================================*/
const AssetsDataTable: React.FC<AssetsDataTableProps> = ({
  project,
  assets,
  tableFooter,
  dateTimeFormat,
  onSortChange,
  currentSortKey,
  currentSortDir,
  hiddenColumns = new Set(),
}) => {
  if (!project) return null;

  const { thumbnails } = useFetchAssetThumbnails(
    project,
    assets
  );

  // Compact mode: only Thumbnail + Name visible
  const compact = isOnlyFixedVisible(hiddenColumns);

  // Header widths to keep header/body aligned in compact mode
  const headerCellStylesById: Record<string, React.CSSProperties> = compact
    ? {
        thumbnail: { width: 140, minWidth: 140, maxWidth: 140 },
        group_1_name: { minWidth: 220 },
      }
    : {};

  // Visible columns for header
  const visibleColumns = columns.filter(
    (c) =>
      !hiddenColumns.has(c.id) || c.id === "thumbnail" || c.id === "group_1_name"
  );

  // IMPORTANT:
  // Render footer OUTSIDE the <Table> so it can be a normal <div> (sticky works reliably).
  // The footer must live inside the same scroll container as the table.
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Table stickyHeader style={{ ...(compact ? { tableLayout: 'fixed' } : {}), width: '100%' }}>
          <RecordTableHead
        key="asset-data-table-head"
        columns={visibleColumns}
        onSortChange={onSortChange}
        currentSortKey={currentSortKey}
        currentSortDir={currentSortDir}
        headerCellStylesById={headerCellStylesById}
      />

      <TableBody>
        {assets.map((asset, index) => (
          <AssetRow
            key={`${asset.group_1}-${asset.relation}-${index}`}
            asset={asset}
            thumbnails={thumbnails}
            phaseComponents={{}} // Provide appropriate value or replace with actual data
            latestComponents={{}} // Provide appropriate value or replace with actual data
            dateTimeFormat={dateTimeFormat}
            isLastRow={index === assets.length - 1}
            hiddenColumns={hiddenColumns}
            compact={compact}

          />
        ))}
      </TableBody>
        </Table>

        {tableFooter || null}
      </div>
    </div>
  );
};

export default AssetsDataTable;