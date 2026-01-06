import React, { useCallback, useMemo, useState } from "react";
import {
  Box,
  IconButton,
  TableContainer,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  makeStyles,
} from "@material-ui/core";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import ChevronRightIcon from "@material-ui/icons/ChevronRight";
import ArrowDropUpIcon from "@material-ui/icons/ArrowDropUp";
import ArrowDropDownIcon from "@material-ui/icons/ArrowDropDown";
import { PivotGroup, SortDir } from "./types";

/** ----------------------------------------------------------------
 *  COLORS (match list view look)
 *  ---------------------------------------------------------------- */
const COLORS = {
  PAGE_BG: "#3d3d3dff",
  TABLE_BG: "#3d3d3dff",
  HEADER_BG: "#3d3d3dff",
  HEADER_BORDER: "#3d3d3dff",
  GRID_LINE: "#555555",
  ROW_BG: "#3d3d3dff",
  GROUP_BG: "#3a3838ff",
  GROUP_TEXT: "#00b7ff",
  TEXT: "#e0e0e0",
  MUTED: "#bdbdbd",

  // top/bottom edge line for NON-phase columns
  COL_EDGE: "#6b6b6b",

  // ✅ use your phase config (lineColor + backgroundColor)
  PHASE: {
    mdl: { lineColor: "#3295fd", backgroundColor: "#354d68" },
    rig: { lineColor: "#c061fd", backgroundColor: "#5e3568" },
    bld: { lineColor: "#fc2f8c", backgroundColor: "#5a0028" },
    dsn: { lineColor: "#98f2bf", backgroundColor: "#045660" },
    ldv: { lineColor: "#fe5cff", backgroundColor: "#683566" },
  },
};

/** ----------------------------------------------------------------
 *  UI controls
 *  ---------------------------------------------------------------- */
const UI = {
  ROW_HEIGHT: 46,
  ROW_PAD_Y: 2,
  ROW_PAD_X: 8,

  // ✅ move NAME + THUMB a bit left
  NAME_PAD_X: 6,
  THUMB_PAD_X: 6,

  ROW_GAP_PX: 0,
  GROUP_ROW_GAP_PX: 2,
  PHASE_GAP_PX: 1,

  RAIL_PX: 3,

  THUMB_WIDTH: 90,
  NAME_WIDTH: 150,
  RELATION_WIDTH: 70,
  PHASE_COL_WIDTH: 97,

  // ✅ “top & bottom line” thickness in header
  COL_EDGE_PX: 2,

  // ✅ thumbs width/height (you asked)
  THUMB_BOX_W: 50,
  THUMB_BOX_H: 28,
  THUMB_RADIUS: 2,
};

type ColumnId =
  | "thumbnail"
  | "group_1_name"
  | "mdl_work"
  | "mdl_appr"
  | "mdl_submitted"
  | "rig_work"
  | "rig_appr"
  | "rig_submitted"
  | "bld_work"
  | "bld_appr"
  | "bld_submitted"
  | "dsn_work"
  | "dsn_appr"
  | "dsn_submitted"
  | "ldv_work"
  | "ldv_appr"
  | "ldv_submitted"
  | "relation";

type Column = {
  id: ColumnId;
  label: string;
  sortable?: boolean;
  phase?: keyof typeof COLORS.PHASE; // mdl|rig|bld|dsn|ldv
  kind?: "work" | "appr" | "submitted";
};

type Props = {
  groups?: PivotGroup[];

  // sorting (support both names if you want)
  sortKey: string;
  sortDir: SortDir;
  onSortChange: (key: string) => void;

  dateTimeFormat: Intl.DateTimeFormat;
  hiddenColumns?: Set<string>;

  /** ✅ IMPORTANT: pass footer from Panel so it renders (sticky) */
  tableFooter?: React.ReactNode;
};

const COLUMNS: Column[] = [
  { id: "thumbnail", label: "THUMBNAIL" },
  { id: "group_1_name", label: "NAME", sortable: true },

  { id: "mdl_work", label: "MDL WORK", sortable: true, phase: "mdl", kind: "work" },
  { id: "mdl_appr", label: "MDL APPR", sortable: true, phase: "mdl", kind: "appr" },
  { id: "mdl_submitted", label: "MDL SUBMITTED AT", sortable: true, phase: "mdl", kind: "submitted" },

  { id: "rig_work", label: "RIG WORK", sortable: true, phase: "rig", kind: "work" },
  { id: "rig_appr", label: "RIG APPR", sortable: true, phase: "rig", kind: "appr" },
  { id: "rig_submitted", label: "RIG SUBMITTED AT", sortable: true, phase: "rig", kind: "submitted" },

  { id: "bld_work", label: "BLD WORK", sortable: true, phase: "bld", kind: "work" },
  { id: "bld_appr", label: "BLD APPR", sortable: true, phase: "bld", kind: "appr" },
  { id: "bld_submitted", label: "BLD SUBMITTED AT", sortable: true, phase: "bld", kind: "submitted" },

  { id: "dsn_work", label: "DSN WORK", sortable: true, phase: "dsn", kind: "work" },
  { id: "dsn_appr", label: "DSN APPR", sortable: true, phase: "dsn", kind: "appr" },
  { id: "dsn_submitted", label: "DSN SUBMITTED AT", sortable: true, phase: "dsn", kind: "submitted" },

  { id: "ldv_work", label: "LDV WORK", sortable: true, phase: "ldv", kind: "work" },
  { id: "ldv_appr", label: "LDV APPR", sortable: true, phase: "ldv", kind: "appr" },
  { id: "ldv_submitted", label: "LDV SUBMITTED AT", sortable: true, phase: "ldv", kind: "submitted" },

  { id: "relation", label: "RELATION", sortable: true },
];

/**
 * ✅ Single scroll container:
 * - ONE vertical scrollbar
 * - horizontal scroll works on data
 * - sticky header + sticky footer stay visible
 */
const useStyles = makeStyles(() => ({
  root: {
    width: "100%",
    height: "100%",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    background: COLORS.PAGE_BG,
  },

  // this is the ONLY scroll area
  scroller: {
    flex: 1,
    minHeight: 0,

    /**
     * ✅ Sticky header needs the scroll to happen in THIS container.
     * Give it a height/maxHeight so it becomes the scroll area.
     * Adjust the 230px if your top bars change.
     */
    maxHeight: "calc(100vh - 230px)",
    overflow: "auto", // ✅ both X and Y
    background: COLORS.PAGE_BG,
  },

  // optional: remove extra padding MUI adds sometimes
  table: {
    background: COLORS.TABLE_BG,
    width: "max-content",
    minWidth: "100%",
    tableLayout: "fixed",
    borderCollapse: "separate",
    borderSpacing: 0,
  },
}));

function getPhaseMetadata(visibleCols: Column[]) {
  const map: Record<string, { start: string; end: string }> = {};
  visibleCols.forEach((col) => {
    if (!col.phase) return;
    if (!map[col.phase]) map[col.phase] = { start: col.id, end: col.id };
    else map[col.phase].end = col.id;
  });
  return map;
}

function formatSubmitted(val: any) {
  if (!val || val === "-") return "-";
  const s = String(val);
  return s.indexOf("T") >= 0 ? s.split("T")[0] : s;
}

function statusColor(status?: string) {
  const s = (status || "").toLowerCase();
  if (!s || s === "-") return COLORS.MUTED;
  if (s.includes("approved")) return "#32cd32";
  if (s.includes("review")) return "#ffa500";
  if (s.includes("retake")) return "#ff4f4f";
  if (s.includes("hold")) return "#ffdd55";
  if (s === "check") return "#ca25ed";
  return COLORS.MUTED;
}

function renderThumbnail(asset: any) {
  const url = asset.thumbnail_url || asset.thumbnail;
  return (
    <Box display="flex" alignItems="center" justifyContent="flex-start">
      <Box
        style={{
          width: UI.THUMB_BOX_W,
          height: UI.THUMB_BOX_H,
          borderRadius: UI.THUMB_RADIUS,
          backgroundColor: "#2a2a2a",
          overflow: "hidden",
        }}
      >
        {url ? (
          <img
            src={url}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : null}
      </Box>
    </Box>
  );
}

function renderAssetField(asset: any, col: Column) {
  if (col.id === "thumbnail") return renderThumbnail(asset);

  if (col.id === "group_1_name") {
    return (
      <Typography noWrap style={{ fontSize: 12, fontWeight: 500 }}>
        {asset.group_1 || ""}
      </Typography>
    );
  }

  if (col.id === "relation") {
    return (
      <Typography style={{ fontSize: 12, fontWeight: 500 }}>
        {asset.relation || "-"}
      </Typography>
    );
  }

  const phase = col.phase;
  if (!phase) return <span>-</span>;

  if (col.kind === "submitted") {
    return (
      <Typography style={{ fontSize: 12, fontWeight: 500 }}>
        {formatSubmitted(asset[phase + "_submitted_at_utc"])}
      </Typography>
    );
  }

  const field = col.kind === "work" ? "work_status" : "approval_status";
  const raw = asset[phase + "_" + field];
  const text = raw || "-";

  return (
    <Typography style={{ fontSize: 12, fontWeight: 500, color: statusColor(text) }}>
      {text}
    </Typography>
  );
}

/**
 * ✅ Header top line + bottom line (per column)
 * ✅ Remove middle line between THUMB and NAME
 * ✅ Phase rails + phase gap
 */
function buildCellStyle(
  col: Column,
  phaseMeta: Record<string, { start: string; end: string }>,
  opts: { header?: boolean; isGroupRow?: boolean } = {}
): React.CSSProperties {
  const { header = false, isGroupRow = false } = opts;

  const meta = col.phase ? phaseMeta[col.phase] : null;
  const isPhaseStart = !!(meta && meta.start === col.id);
  const isPhaseEnd = !!(meta && meta.end === col.id);

  const phaseCfg = col.phase ? COLORS.PHASE[col.phase] : null;
  const edgeColor = col.phase ? phaseCfg!.lineColor : COLORS.COL_EDGE;

  const headerBg = col.phase ? phaseCfg!.backgroundColor : COLORS.HEADER_BG;

  const paddingX =
    col.id === "group_1_name" ? UI.NAME_PAD_X : col.id === "thumbnail" ? UI.THUMB_PAD_X : UI.ROW_PAD_X;

  const style: React.CSSProperties = {
    backgroundColor: header ? headerBg : COLORS.ROW_BG,
    color: header ? "#fff" : COLORS.TEXT,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    height: UI.ROW_HEIGHT,
    padding: (header ? 8 : UI.ROW_PAD_Y) + "px " + paddingX + "px",
    fontSize: 12,
    fontWeight: header ? 800 : 500,
    borderLeft: "0px",
    borderRight: "0px",
    borderBottom: header
      ? "1px solid " + COLORS.HEADER_BORDER
      : (isGroupRow ? UI.GROUP_ROW_GAP_PX : UI.ROW_GAP_PX) + "px solid " + COLORS.TABLE_BG,
  };

  // ✅ top + bottom line in header for each column
  const shadows: string[] = [];
  if (header) {
    shadows.push(`inset 0 ${UI.COL_EDGE_PX}px 0 0 ${edgeColor}`);
    shadows.push(`inset 0 -${UI.COL_EDGE_PX}px 0 0 ${edgeColor}`);
  }

  // phase rails
  if (col.phase) {
    const rail = phaseCfg!.lineColor;
    if (isPhaseStart) shadows.push(`inset ${UI.RAIL_PX}px 0 0 0 ${rail}`);
    if (isPhaseEnd) shadows.push(`inset -${UI.RAIL_PX}px 0 0 0 ${rail}`);

    // gap after phase end
    if (isPhaseEnd) style.borderRight = UI.PHASE_GAP_PX + "px solid " + COLORS.TABLE_BG;
  } else {
    // ✅ remove vertical line between THUMBNAIL and NAME
    if (col.id === "thumbnail") style.borderRight = "0px";
    else style.borderRight = "1px solid " + (header ? COLORS.HEADER_BORDER : COLORS.GRID_LINE);
  }

  if (shadows.length) style.boxShadow = shadows.join(", ");

  return style;
}

const AssetsGroupedDataTable: React.FC<Props> = ({
  groups = [],
  sortKey,
  sortDir,
  onSortChange,
  dateTimeFormat, // kept
  hiddenColumns = new Set(),
  tableFooter,
}) => {
  const classes = useStyles();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = useCallback((key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const visibleColumns = useMemo(
    () => COLUMNS.filter((c) => !hiddenColumns.has(c.id)),
    [hiddenColumns]
  );

  const phaseMeta = useMemo(() => getPhaseMetadata(visibleColumns), [visibleColumns]);

  return (
    <Box className={classes.root}>
      <TableContainer className={classes.scroller}>
        <Table size="small" stickyHeader className={classes.table}>
          {/* fixed column widths */}
          <colgroup>
            {visibleColumns.map((col) => {
              let w = UI.PHASE_COL_WIDTH;
              if (col.id === "thumbnail") w = UI.THUMB_WIDTH;
              if (col.id === "group_1_name") w = UI.NAME_WIDTH;
              if (col.id === "relation") w = UI.RELATION_WIDTH;
              return <col key={col.id} style={{ width: w }} />;
            })}
          </colgroup>

          <TableHead>
            <TableRow>
              {visibleColumns.map((col) => (
                <TableCell
                  key={col.id}
                  align={col.id === "group_1_name" || col.id === "thumbnail" ? "left" : "center"}
                  onClick={() => col.sortable && onSortChange(col.id)}
                  style={{
                    ...buildCellStyle(col, phaseMeta, { header: true }),
                    cursor: col.sortable ? "pointer" : "default",
                    position: "sticky",
                    top: 0,
                    zIndex: 20,
                  }}
                >
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent={col.id === "group_1_name" || col.id === "thumbnail" ? "flex-start" : "center"}
                  >
                    <Typography style={{ fontSize: "0.70rem", fontWeight: 900 }}>
                      {col.label}
                    </Typography>

                    {sortKey === col.id &&
                      (sortDir === "asc" ? (
                        <ArrowDropUpIcon fontSize="small" />
                      ) : (
                        <ArrowDropDownIcon fontSize="small" />
                      ))}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {groups.map((group) => {
              const groupName = group.top_group_node || "UNASSIGNED";
              const isCollapsed = !!collapsed[groupName];

              return (
                <React.Fragment key={groupName}>
                  {/* Group row */}
                  <TableRow onClick={() => toggle(groupName)} style={{ cursor: "pointer" }}>
                    <TableCell
                      colSpan={visibleColumns.length}
                      style={{
                        backgroundColor: COLORS.GROUP_BG,
                        color: COLORS.GROUP_TEXT,
                        borderBottom: UI.GROUP_ROW_GAP_PX + "px solid " + COLORS.TABLE_BG,
                        padding: "6px 10px",
                        fontWeight: 900,
                      }}
                    >
                      <Box display="flex" alignItems="center">
                        <IconButton size="small" style={{ color: COLORS.GROUP_TEXT, padding: 0 }}>
                          {isCollapsed ? (
                            <ChevronRightIcon fontSize="small" />
                          ) : (
                            <ExpandMoreIcon fontSize="small" />
                          )}
                        </IconButton>

                        <Typography
                          style={{
                            color: COLORS.GROUP_TEXT,
                            fontSize: "0.80rem",
                            fontWeight: 900,
                            marginLeft: 10,
                          }}
                        >
                          {groupName.toUpperCase()}{" "}
                          <span style={{ fontSize: "0.75rem", fontWeight: 800 }}>
                            ({(group.items || []).length} of {(group as any).totalCount ?? (group.items || []).length})
                          </span>
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>

                  {/* Data rows */}
                  {!isCollapsed &&
                    (group.items || []).map((asset: any, idx: number) => (
                      <TableRow key={groupName + "-" + idx} hover>
                        {visibleColumns.map((col) => (
                          <TableCell
                            key={col.id}
                            align={col.id === "group_1_name" || col.id === "thumbnail" ? "left" : "center"}
                            style={buildCellStyle(col, phaseMeta)}
                          >
                            {renderAssetField(asset, col)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                </React.Fragment>
              );
            })}
          </TableBody>

          {/* ✅ Sticky footer pagination (Rows-per-page always visible) */}
          {tableFooter ? tableFooter : null}
        </Table>
      </TableContainer>
    </Box>
  );
};

export default AssetsGroupedDataTable;