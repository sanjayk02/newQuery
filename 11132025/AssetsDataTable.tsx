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
  AssetPhaseSummary,
} from "./types";
import { useFetchAssetThumbnails } from "./hooks";

// ======================================================================
//                        COLORS + COLUMN META
// ======================================================================
const ASSET_PHASES: { [key: string]: Colors } = {
  mdl: { lineColor: "#3295fd", backgroundColor: "#354d68" },
  rig: { lineColor: "#c061fd", backgroundColor: "#5e3568" },
  bld: { lineColor: "#fc2f8c", backgroundColor: "#5a0028" },
  dsn: { lineColor: "#98f2fb", backgroundColor: "#045660" },
  ldv: { lineColor: "#fe5cff", backgroundColor: "#683566" },
};

type Status = Readonly<{ displayName: string; color: string }>;

type AssetsDataTablePropsLocal = AssetsDataTableProps & {
  currentSortKey: string;
  currentSortDir: SortDir;
  onSortChange: (sortKey: string) => void;
  hiddenColumns?: Set<string>;

  // filter echoes (you were already passing these from the panel)
  assetNameKey: string;
  approvalStatuses: string[];
  workStatuses: string[];
};

const APPROVAL_STATUS: { [key: string]: Status } = {
  check: { displayName: "Check", color: "#ca25ed" },
  clientReview: { displayName: "Client Review", color: "#005fbd" },
  dirReview: { displayName: "Dir Review", color: "#007fff" },
  epdReview: { displayName: "EPD Review", color: "#4fa7ff" },
  clientOnHold: { displayName: "Client On Hold", color: "#d69b00" },
  dirOnHold: { displayName: "Dir On Hold", color: "#ffcc00" },
  epdOnHold: { displayName: "EPD On Hold", color: "#ffdd55" },
  execRetake: { displayName: "Exec Retake", color: "#a60000" },
  clientRetake: { displayName: "Client Retake", color: "#c60000" },
  dirRetake: { displayName: "Dir Retake", color: "#ff0000" },
  epdRetake: { displayName: "EPD Retake", color: "#ff4f4f" },
  clientApproved: { displayName: "Client Approved", color: "#1d7c39" },
  dirApproved: { displayName: "Dir Approved", color: "#27ab4f" },
  epdApproved: { displayName: "EPD Approved", color: "#5cda82" },
  review: { displayName: "Review", color: "#ffa500" },
  inProgress: { displayName: "In Progress", color: "#00bfff" },
  notStarted: { displayName: "Not Started", color: "#d3d3d3" },
  approved: { displayName: "Approved", color: "#32cd32" },
  other: { displayName: "Other", color: "#9a9a9a" },
  omit: { displayName: "Omit", color: "#646464" },
};

const WORK_STATUS: { [key: string]: Status } = {
  check: { displayName: "Check", color: "#e287f5" },
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

// ======================================================================
//                        COLUMN LIST
// ======================================================================
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

// IDs that are *not* fixed; used to know when only thumbnail+name are visible
const NON_FIXED_IDS = columns
  .map(c => c.id)
  .filter(id => id !== "thumbnail" && id !== "group_1_name");

const isOnlyFixedVisible = (hidden: Set<string>) =>
  NON_FIXED_IDS.every(id => hidden.has(id));

// ======================================================================
//                 ✅ MultiLineTooltipTableCell
// ======================================================================
type TooltipTableCellProps = {
  tooltipText: string;
  status: Status | undefined;
  leftBorderStyle: string;
  rightBorderStyle: string;
  bottomBorderStyle?: string;
};

const MultiLineTooltipTableCell: React.FC<TooltipTableCellProps> = ({
  tooltipText,
  status,
  leftBorderStyle,
  rightBorderStyle,
  bottomBorderStyle = "none",
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
          title={
            <div style={{ fontSize: "0.8rem", whiteSpace: "pre-wrap" }}>
              {tooltipText}
            </div>
          }
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

// ======================================================================
//                 ✅ RecordTableHead
// ======================================================================
const RecordTableHead: React.FC<
  RecordTableHeadProps & {
    onSortChange: (sortKey: string) => void;
    currentSortKey: string;
    currentSortDir: SortDir;
    headerCellStylesById?: Record<string, React.CSSProperties>;
  }
> = ({
  columns,
  onSortChange,
  currentSortKey,
  currentSortDir,
  headerCellStylesById = {},
}) => {
  const createSortHandler = (sortKey: string | undefined, idFallback: string) =>
    () => onSortChange(sortKey || idFallback);

  return (
    <TableHead>
      <TableRow>
        {columns.map((column) => {
          const sortKey = column.sortKey || column.id;
          const active = currentSortKey === sortKey;
          const styles = headerCellStylesById[column.id] || {};
          return (
            <TableCell key={column.id} style={styles}>
              {column.sortable ? (
                <TableSortLabel
                  active={active}
                  direction={
                    active && currentSortDir !== "none"
                      ? currentSortDir
                      : "asc"
                  }
                  onClick={createSortHandler(column.sortKey, column.id)}
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

// ======================================================================
//                 ✅ AssetRow
// ======================================================================
const AssetRow: React.FC<
  AssetRowProps & {
    columns: Column[];
  }
> = ({ asset, columns }) => {
  // asset is expected to be an AssetPhaseSummary-like object
  const row: any = asset;

  const getStatus = (colId: string): Status | undefined => {
    if (colId.endsWith("_work_status")) {
      const key = (row[colId] || "").toString();
      return WORK_STATUS[key] || undefined;
    }
    if (colId.endsWith("_approval_status")) {
      const key = (row[colId] || "").toString();
      return APPROVAL_STATUS[key] || undefined;
    }
    return undefined;
  };

  return (
    <TableRow hover>
      {columns.map((col) => {
        if (col.id === "thumbnail") {
          const thumb = row.thumbnail || "No Thumbnail";
          return <TableCell key={col.id}>{thumb}</TableCell>;
        }

        const val = row[col.id];

        // For work / approval cells, use the tooltip cell
        if (
          col.id.endsWith("_work_status") ||
          col.id.endsWith("_approval_status")
        ) {
          const status = getStatus(col.id);
          // simple tooltip source – adapt if you have richer comment fields
          const tooltipText =
            (row[`${col.id}_memo`] as string) ||
            (row[`${col.id}_comment`] as string) ||
            "";
          return (
            <MultiLineTooltipTableCell
              key={col.id}
              tooltipText={tooltipText || ""}
              status={status}
              leftBorderStyle="1px solid rgba(255,255,255,0.12)"
              rightBorderStyle="1px solid rgba(255,255,255,0.12)"
              bottomBorderStyle="1px solid rgba(255,255,255,0.12)"
            />
          );
        }

        return (
          <TableCell key={col.id}>
            {val == null || val === "" ? "-" : String(val)}
          </TableCell>
        );
      })}
    </TableRow>
  );
};

// ======================================================================
//                 ✅ AssetsDataTable (main component)
// ======================================================================
const AssetsDataTable: React.FC<AssetsDataTablePropsLocal> = ({
  assets,
  currentSortKey,
  currentSortDir,
  onSortChange,
  hiddenColumns,
  assetNameKey,
  approvalStatuses,
  workStatuses,
}) => {
  // Filter columns based on hiddenColumns coming from the drawer
  const visibleColumns = React.useMemo(
    () => columns.filter((c) => !hiddenColumns || !hiddenColumns.has(c.id)),
    [hiddenColumns]
  );

  // (Optional) thumbnails hook – adapt to your shape
  const thumbs = useFetchAssetThumbnails(assets || []);

  // We could filter rows here by assetNameKey / statuses if needed;
  // currently server-side does main filtering.

  const headerCellStylesById: Record<string, React.CSSProperties> = {};
  // you can put per-column width / alignment here if you had them before

  return (
    <Table size="small" stickyHeader>
      <RecordTableHead
        columns={visibleColumns}
        onSortChange={onSortChange}
        currentSortKey={currentSortKey}
        currentSortDir={currentSortDir}
        headerCellStylesById={headerCellStylesById}
      />
      <TableBody>
        {(assets || []).map((asset: AssetPhaseSummary) => (
          <AssetRow
            key={`${asset.group_1_name}-${asset.relation}`}
            asset={asset}
            columns={visibleColumns}
          />
        ))}
      </TableBody>
    </Table>
  );
};

export default AssetsDataTable;
