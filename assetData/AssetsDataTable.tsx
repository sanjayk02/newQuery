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
  mdl: {
    lineColor: "#3295fd",
    backgroundColor: "#354d68",
  },
  rig: {
    lineColor: "#c061fd",
    backgroundColor: "#5e3568",
  },
  bld: {
    lineColor: "#fc2f8c",
    backgroundColor: "#5a0028",
  },
  dsn: {
    lineColor: "#98f2fb",
    backgroundColor: "#045660",
  },
  ldv: {
    lineColor: "#fe5cff",
    backgroundColor: "#683566",
  },
};

type Status = Readonly<{
  displayName: string;
  color: string;
}>;

const APPROVAL_STATUS: { [key: string]: Status } = {
  check: {
    displayName: "Check",
    color: "#ca25ed",
  },
  clientReview: {
    displayName: "Client Review",
    color: "#005fbd",
  },
  dirReview: {
    displayName: "Dir Review",
    color: "#007fff",
  },
  epdReview: {
    displayName: "EPD Review",
    color: "#4fa7ff",
  },
  clientOnHold: {
    displayName: "Client On Hold",
    color: "#d69b00",
  },
  dirOnHold: {
    displayName: "Dir On Hold",
    color: "#ffcc00",
  },
  epdOnHold: {
    displayName: "EPD On Hold",
    color: "#ffdd55",
  },
  execRetake: {
    displayName: "Exec Retake",
    color: "#a60000",
  },
  clientRetake: {
    displayName: "Client Retake",
    color: "#c60000",
  },
  dirRetake: {
    displayName: "Dir Retake",
    color: "#ff0000",
  },
  epdRetake: {
    displayName: "EPD Retake",
    color: "#ff4f4f",
  },
  clientApproved: {
    displayName: "Client Approved",
    color: "#1d7c39",
  },
  dirApproved: {
    displayName: "Dir Approved",
    color: "#27ab4f",
  },
  epdApproved: {
    displayName: "EPD Approved",
    color: "#5cda82",
  },
  other: {
    displayName: "Other",
    color: "#9a9a9a",
  },
  omit: {
    displayName: "Omit",
    color: "#646464",
  },
};

const WORK_STATUS: { [key: string]: Status } = {
  check: {
    displayName: "Check",
    color: "#e287f5",
  },
  cgsvOnHold: {
    displayName: "CGSV On Hold",
    color: "#ffdd55",
  },
  svOnHold: {
    displayName: "SV On Hold",
    color: "#ffe373",
  },
  leadOnHold: {
    displayName: "Lead On Hold",
    color: "#fff04f",
  },
  cgsvRetake: {
    displayName: "CGSV Retake",
    color: "#ff4f4f",
  },
  svRetake: {
    displayName: "SV Retake",
    color: "#ff8080",
  },
  leadRetake: {
    displayName: "Lead Retake",
    color: "#ffbbbb",
  },
  cgsvApproved: {
    displayName: "CGSV Approved",
    color: "#5cda82",
  },
  svApproved: {
    displayName: "SV Approved",
    color: "#83e29f",
  },
  leadApproved: {
    displayName: "Lead Approved",
    color: "#b9eec9",
  },
  svOther: {
    displayName: "SV Other",
    color: "#9a9a9a",
  },
  leadOther: {
    displayName: "Lead Other",
    color: "#dbdbdb",
  },
};

// ======================================================================
//                        COLUMN LIST (UNCHANGED)
// ======================================================================
const columns: Column[] = [
  { id: "thumbnail", label: "Thumbnail" },
  {
    id: "group_1_name",
    label: "Name",
    sortable: true,
    sortKey: "group_1",
  },
  {
    id: "mdl_work_status",
    label: "MDL WORK",
    colors: ASSET_PHASES.mdl,
    sortable: true,
    sortKey: "mdl_work",
  },
  {
    id: "mdl_approval_status",
    label: "MDL APPR",
    colors: ASSET_PHASES.mdl,
    sortable: true,
    sortKey: "mdl_appr",
  },
  {
    id: "mdl_submitted_at",
    label: "MDL Submitted At",
    colors: ASSET_PHASES.mdl,
    sortable: true,
    sortKey: "mdl_submitted",
  },
  {
    id: "rig_work_status",
    label: "RIG WORK",
    colors: ASSET_PHASES.rig,
    sortable: true,
    sortKey: "rig_work",
  },
  {
    id: "rig_approval_status",
    label: "RIG APPR",
    colors: ASSET_PHASES.rig,
    sortable: true,
    sortKey: "rig_appr",
  },
  {
    id: "rig_submitted_at",
    label: "RIG Submitted At",
    colors: ASSET_PHASES.rig,
    sortable: true,
    sortKey: "rig_submitted",
  },
  {
    id: "bld_work_status",
    label: "BLD WORK",
    colors: ASSET_PHASES.bld,
    sortable: true,
    sortKey: "bld_work",
  },
  {
    id: "bld_approval_status",
    label: "BLD APPR",
    colors: ASSET_PHASES.bld,
    sortable: true,
    sortKey: "bld_appr",
  },
  {
    id: "bld_submitted_at",
    label: "BLD Submitted At",
    colors: ASSET_PHASES.bld,
    sortable: true,
    sortKey: "bld_submitted",
  },
  {
    id: "dsn_work_status",
    label: "DSN WORK",
    colors: ASSET_PHASES.dsn,
    sortable: true,
    sortKey: "dsn_work",
  },
  {
    id: "dsn_approval_status",
    label: "DSN APPR",
    colors: ASSET_PHASES.dsn,
    sortable: true,
    sortKey: "dsn_appr",
  },
  {
    id: "dsn_submitted_at",
    label: "DSN Submitted At",
    colors: ASSET_PHASES.dsn,
    sortable: true,
    sortKey: "dsn_submitted",
  },
  {
    id: "ldv_work_status",
    label: "LDV WORK",
    colors: ASSET_PHASES.ldv,
    sortable: true,
    sortKey: "ldv_work",
  },
  {
    id: "ldv_approval_status",
    label: "LDV APPR",
    colors: ASSET_PHASES.ldv,
    sortable: true,
    sortKey: "ldv_appr",
  },
  {
    id: "ldv_submitted_at",
    label: "LDV Submitted At",
    colors: ASSET_PHASES.ldv,
    sortable: true,
    sortKey: "ldv_submitted",
  },

  { id: "relation", label: "Relation", sortable: true, sortKey: "relation" },
];

// ======================================================================
//            🔧 Compact-mode helpers for “only fixed visible”
// ======================================================================

// IDs that are NOT fixed (everything except thumbnail + name)
const NON_FIXED_IDS = columns
  .map((c) => c.id)
  .filter((id) => id !== "thumbnail" && id !== "group_1_name");

// Helper to know when only the fixed columns are visible
const isOnlyFixedVisible = (hidden: Set<string>) => {
  return NON_FIXED_IDS.every((id) => hidden.has(id));
};

// ======================================================================
//                 ✅ MultiLineTooltipTableCell (UNCHANGED)
// ======================================================================

type TooltipTableCellProps = {
  tooltipText: string,
  status: Status | undefined,
  leftBorderStyle: string,
  rightBorderStyle: string,
  bottomBorderStyle: string,
};

const MultiLineTooltipTableCell: React.FC<TooltipTableCellProps> = (
  { tooltipText, status, leftBorderStyle, rightBorderStyle, bottomBorderStyle = 'none' }
) => {
  const [open, setOpen] = React.useState(false);
  const isTooltipTextEmpty = tooltipText && tooltipText.trim().length > 0;

  const handleTooltipClose = () => {
    setOpen(false);
  };

  const handleTooltipOpen = () => {
    setOpen(true);
  };

  const statusText = (status != null) ? status['displayName'] : '-';

  return (
    <TableCell
      style={{
        color: (status != null) ? status['color'] : '',
        fontStyle: (tooltipText === '') ? 'normal' : 'oblique',
        borderLeft: leftBorderStyle,
        borderRight: rightBorderStyle,
        borderBottom: bottomBorderStyle,
      }}
      onClick={isTooltipTextEmpty ? handleTooltipOpen : undefined}
    >
      {isTooltipTextEmpty ? (
        <Tooltip
          title={
            <div
              style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
              {tooltipText}
            </div>
          }
          onClose={handleTooltipClose}
          open={open}
          arrow
        >
          <span>{statusText}</span>
        </Tooltip>
      ) : (
        <span>{statusText}</span>
      )}
    </TableCell >
  );
};

// ======================================================================
//                 ✅ RecordTableHead (UPDATED)
// ======================================================================
const RecordTableHead: React.FC<RecordTableHeadProps & {
  onSortChange: (sortKey: string) => void,
  currentSortKey: string,
  currentSortDir: SortDir, // ADDED: Current sort direction
  headerCellStylesById?: Record<string, React.CSSProperties>, // NEW
}> = ({
  columns, onSortChange, currentSortKey, currentSortDir, headerCellStylesById = {},
}) => {
  const getSortDir = (id: string, activeSortKey: string, activeSortDir: SortDir): SortDir => {
    // Only return the direction if the key matches the active key
    if (activeSortKey === id) return activeSortDir;
    return 'none';
  };

  const createSortHandler = (id: string) => () => {
    // Pass the column's ID to the panel. The panel handles the direction toggle.
    onSortChange(id);
  };

  return (
    <TableHead>
      <TableRow>
        {columns.map((column) => {
          const borderLineStyle = column.colors ? `solid 3px ${column.colors.lineColor}` : 'none';
          const borderTopStyle = column.colors ? borderLineStyle : 'none';
          const borderLeftStyle = (column.id.indexOf('work_status') !== -1) ? borderLineStyle : 'none';
          const borderRightStyle = (column.id.indexOf('submitted_at') !== -1) ? borderLineStyle : 'none';

          const columnSortKey = column.sortKey || column.id;
          // PASS currentSortKey and currentSortDir
          const sortDir = getSortDir(columnSortKey, currentSortKey, currentSortDir);

          return (
            <TableCell
              key={column.id}
              style={{
                backgroundColor: column.colors ? column.colors.backgroundColor : 'none',
                borderTop: borderTopStyle,
                borderLeft: borderLeftStyle,
                borderRight: borderRightStyle,
                ...(headerCellStylesById[column.id] || {}), // << apply compact widths
              }}
            >
              {column.sortable ? (
                <TableSortLabel
                  active={sortDir !== 'none'}
                  hideSortIcon
                  direction={sortDir === 'desc' ? 'desc' : 'asc'}
                  onClick={createSortHandler(columnSortKey)}
                  IconComponent={() => (
                    <span style={{
                      fontSize: "16px",
                      fontWeight: 750,
                      lineHeight: "24px",
                      marginLeft: "10px",
                      userSelect: "none"
                    }}>
                      {sortDir === 'desc' ? '▼' : '▲'}
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

// ======================================================================
//                      ✅ AssetRow (UPDATED)
// ======================================================================
const AssetRow: React.FC<
  AssetRowProps & { hiddenColumns: Set<string>; compact: boolean }
> = ({ asset, thumbnails, dateTimeFormat, isLastRow, hiddenColumns, compact }) => {
  const isHidden = (id: string) => hiddenColumns.has(id);

  const getPhaseData = (phase: string) => {
    const workStatusKey = `${phase}_work_status` as keyof AssetPhaseSummary;
    const approvalStatusKey =
      `${phase}_approval_status` as keyof AssetPhaseSummary;
    const submittedAtKey =
      `${phase}_submitted_at_utc` as keyof AssetPhaseSummary;

    const workStatusValue = asset[workStatusKey];
    const approvalStatusValue = asset[approvalStatusKey];
    const submittedAtValue = asset[submittedAtKey];

    const workStatus: Status | undefined = workStatusValue
      ? WORK_STATUS[String(workStatusValue).toLowerCase()]
      : undefined;
    const approvalStatus: Status | undefined = approvalStatusValue
      ? APPROVAL_STATUS[String(approvalStatusValue).toLowerCase()]
      : undefined;

    const submittedAt = submittedAtValue
      ? new Date(submittedAtValue as string)
      : null;
    const localTimeText = submittedAt ? dateTimeFormat.format(submittedAt) : "-";

    return {
      workStatus,
      approvalStatus,
      localTimeText,
      tooltipText: "",
    };
  };

  return (
    <TableRow>
      {!isHidden("thumbnail") && (
        <TableCell
          style={compact ? { width: 140, minWidth: 140, maxWidth: 140 } : undefined}
        >
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

      {!isHidden("group_1_name") && (
        <TableCell style={compact ? { minWidth: 220 } : undefined}>
          {asset.group_1}
        </TableCell>
      )}

      {/* Skip phase groups entirely in compact mode */}
      {!compact &&
        Object.entries(ASSET_PHASES).map(([phase, { lineColor }]) => {
          const kWork = `${phase}_work_status`;
          const kAppr = `${phase}_approval_status`;
          const kSub = `${phase}_submitted_at`;

          if (isHidden(kWork) && isHidden(kAppr) && isHidden(kSub)) {
            return null;
          }

          const {
            workStatus,
            approvalStatus,
            localTimeText,
            tooltipText,
          } = getPhaseData(phase);

          const borderLineStyle = `solid 3px ${lineColor}`;

          return (
            <React.Fragment key={`${asset.group_1}-${asset.relation}-${phase}`}>
              {!isHidden(kWork) && (
                <MultiLineTooltipTableCell
                  tooltipText={tooltipText}
                  status={workStatus}
                  leftBorderStyle={borderLineStyle}
                  rightBorderStyle={"none"}
                  bottomBorderStyle={isLastRow ? borderLineStyle : "none"}
                />
              )}

              {!isHidden(kAppr) && (
                <MultiLineTooltipTableCell
                  tooltipText={tooltipText}
                  status={approvalStatus}
                  leftBorderStyle={"none"}
                  rightBorderStyle={"none"}
                  bottomBorderStyle={isLastRow ? borderLineStyle : "none"}
                />
              )}

              {!isHidden(kSub) && (
                <TableCell
                  style={{
                    borderLeft: "none",
                    borderRight: borderLineStyle,
                    borderBottom: isLastRow ? borderLineStyle : "none",
                  }}
                >
                  {localTimeText}
                </TableCell>
              )}
            </React.Fragment>
          );
        })}

      {/* Relation only shown in non-compact mode (to keep two-column compact tidy) */}
      {!isHidden("relation") && !compact && <TableCell>{asset.relation}</TableCell>}
    </TableRow>
  );
};

// ======================================================================
//                   ✅ AssetsDataTable (UPDATED)
// ======================================================================

const AssetsDataTable: React.FC<
  AssetsDataTableProps & {
    currentSortKey: string;
    currentSortDir: SortDir;
    onSortChange: (sortKey: string) => void;
    hiddenColumns?: Set<string>;
  }
> = ({
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
    assets.map((a) => ({ name: a.group_1, relation: a.relation }))
  );

  // Detect compact mode (only Thumbnail + Name visible)
  const compact = isOnlyFixedVisible(hiddenColumns);

  // Header widths to keep header/body aligned in compact mode
  const headerCellStylesById: Record<string, React.CSSProperties> = compact
    ? {
        thumbnail: { width: 140, minWidth: 140, maxWidth: 140 },
        group_1_name: { minWidth: 220 },
      }
    : {};

  // Filter columns for header
  const visibleColumns = columns.filter(
    (c) =>
      !hiddenColumns.has(c.id) ||
      c.id === "thumbnail" ||
      c.id === "group_1_name"
  );

  return (
    <Table
      stickyHeader
      style={compact ? { tableLayout: 'fixed', width: '100%' } : undefined}
    >
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
            dateTimeFormat={dateTimeFormat}
            isLastRow={index === assets.length - 1}
            hiddenColumns={hiddenColumns}
            compact={compact}
          />
        ))}
      </TableBody>

      {tableFooter || null}
    </Table>
  );
};

export default AssetsDataTable;
