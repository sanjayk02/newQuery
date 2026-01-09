import React, { useCallback, useMemo, useState } from "react";
import {
  Box,
  IconButton,
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
 * COLORS (match list view look)
 * ---------------------------------------------------------------- */
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
  COL_EDGE: "#6b6b6b",
};

const useStyles = makeStyles((theme) => ({
  // Creates a local scroll context so sticky elements stay in view
  rootContainer: {
    height: "100%",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  scrollBox: {
    flex: 1,
    overflow: "auto",
    backgroundColor: COLORS.PAGE_BG,
    position: "relative",
  },
  table: {
    minWidth: "100%",
    borderCollapse: "separate", // Required for sticky borders to render correctly
  },
  headerCell: {
    backgroundColor: COLORS.HEADER_BG,
    color: COLORS.TEXT,
    fontWeight: "bold",
    borderBottom: `1px solid ${COLORS.GRID_LINE}`,
    zIndex: 10, // Higher than group rows
  },
  stickyGroupRow: {
    position: "sticky",
    top: 48, // Offset by the height of the main TableHead
    zIndex: 5,
    backgroundColor: COLORS.GROUP_BG,
    "& td": {
      borderBottom: `1px solid ${COLORS.GRID_LINE}`,
    }
  },
  footerWrapper: {
    position: "sticky",
    bottom: 0,
    zIndex: 10,
    backgroundColor: COLORS.TABLE_BG,
    borderTop: `1px solid ${COLORS.GRID_LINE}`,
  }
}));

interface Props {
  groups: PivotGroup[];
  columns: any[];
  hiddenColumns: Set<string>;
  onSortChange: (key: string) => void;
  currentSortKey: string;
  currentSortDir: SortDir;
  renderAssetField: (asset: any, col: any) => React.ReactNode;
  buildCellStyle: (col: any, phaseMeta: any) => React.CSSProperties;
  phaseMeta?: any;
  tableFooter?: React.ReactNode;
}

const AssetsGroupedDataTable: React.FC<Props> = ({
  groups,
  columns,
  hiddenColumns,
  onSortChange,
  currentSortKey,
  currentSortDir,
  renderAssetField,
  buildCellStyle,
  phaseMeta,
  tableFooter,
}) => {
  const classes = useStyles();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const visibleColumns = useMemo(() => {
    return columns.filter(
      (c) => !hiddenColumns.has(c.id) || c.id === "thumbnail" || c.id === "group_1_name"
    );
  }, [columns, hiddenColumns]);

  const toggleGroup = useCallback((groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  }, []);

  return (
    <Box className={classes.rootContainer}>
      <Box className={classes.scrollBox}>
        <Table className={classes.table} stickyHeader>
          <TableHead>
            <TableRow>
              {visibleColumns.map((col) => {
                const isSorted = currentSortKey === col.id;
                return (
                  <TableCell
                    key={col.id}
                    className={classes.headerCell}
                    align={col.id === "group_1_name" || col.id === "thumbnail" ? "left" : "center"}
                    onClick={() => onSortChange(col.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <Box display="flex" alignItems="center" justifyContent={col.id === "group_1_name" ? "flex-start" : "center"}>
                      {col.label}
                      {isSorted && (
                        currentSortDir === "asc" ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />
                      )}
                    </Box>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>

          <TableBody>
            {groups.map((group) => {
              const groupName = group.top_group_node || "Unknown";
              const isCollapsed = collapsedGroups.has(groupName);
              const totalCount = group.total_count_in_group || 0;
              const visibleCount = (group.items || []).length;

              return (
                <React.Fragment key={groupName}>
                  {/* Sticky Group Header */}
                  <TableRow className={classes.stickyGroupRow}>
                    <TableCell colSpan={visibleColumns.length} style={{ padding: "4px 12px" }}>
                      <Box display="flex" alignItems="center">
                        <IconButton
                          size="small"
                          onClick={() => toggleGroup(groupName)}
                          style={{ color: COLORS.GROUP_TEXT }}
                        >
                          {isCollapsed ? <ChevronRightIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                        <Typography
                          variant="subtitle2"
                          style={{ color: COLORS.GROUP_TEXT, fontWeight: 700, marginLeft: 10 }}
                        >
                          {groupName.toUpperCase()}{" "}
                          <span style={{ fontSize: "0.75rem", fontWeight: 800 }}>
                            ({visibleCount} of {totalCount})
                          </span>
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>

                  {/* Data Rows */}
                  {!isCollapsed &&
                    (group.items || []).map((asset: any, idx: number) => (
                      <TableRow key={`${groupName}-${idx}`} hover>
                        {visibleColumns.map((col) => (
                          <TableCell
                            key={col.id}
                            align={col.id === "group_1_name" || col.id === "thumbnail" ? "left" : "center"}
                            style={{ 
                              ...buildCellStyle(col, phaseMeta), 
                              borderBottom: `1px solid ${COLORS.GRID_LINE}` 
                            }}
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
        </Table>
      </Box>

      {/* Sticky Footer - renders at the bottom of the container */}
      {tableFooter && (
        <Box className={classes.footerWrapper}>
          {tableFooter}
        </Box>
      )}
    </Box>
  );
};

export default AssetsGroupedDataTable;
