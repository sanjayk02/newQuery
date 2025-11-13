import React from "react";
import {
  Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel,
} from "@material-ui/core";
import {
  AssetsDataTableProps, Colors, Column, SortDir,
} from "./types";
import { useFetchAssetThumbnails } from "./hooks";

/* Colors per phase */
const ASSET_PHASES: { [key: string]: Colors } = {
  mdl: { lineColor: "#3295fd", backgroundColor: "#354d68" },
  rig: { lineColor: "#c061fd", backgroundColor: "#5e3568" },
  bld: { lineColor: "#fc2f8c", backgroundColor: "#5a0028" },
  dsn: { lineColor: "#98f2fb", backgroundColor: "#045660" },
  ldv: { lineColor: "#fe5cff", backgroundColor: "#683566" },
};

/* Table columns (ids must match data & drawer) */
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

/* Props extension used by panel */
type AssetsDataTablePropsLocal = AssetsDataTableProps & {
  currentSortKey: string;
  currentSortDir: SortDir;
  onSortChange: (sortKey: string) => void;
  hiddenColumns?: Set<string>;

  // filter echoes (unused in this file but kept for parity)
  assetNameKey: string;
  approvalStatuses: string[];
  workStatuses: string[];
};

const AssetsDataTable: React.FC<AssetsDataTablePropsLocal> = (props) => {
  const {
    assets,
    currentSortKey, currentSortDir, onSortChange,
    hiddenColumns,
  } = props;

  /* Respect hidden columns */
  const visibleColumns = React.useMemo(
    () => columns.filter(c => !hiddenColumns || !hiddenColumns.has(c.id)),
    [hiddenColumns]
  );

  const getSortDir = (id: string, activeKey: string, activeDir: SortDir): SortDir =>
    activeKey === id ? activeDir : "none";
  const createSortHandler = (id: string) => () => onSortChange(id);

  // (Optional) thumbnails hook
  const thumbs = useFetchAssetThumbnails(assets || []);

  return (
    <Table size="small" stickyHeader>
      {/* Header */}
      <TableHead>
        <TableRow>
          {visibleColumns.map((column) => {
            const active = column.sortable && column.sortKey ? column.sortKey : column.id;
            return (
              <TableCell key={column.id}>
                {column.sortable ? (
                  <TableSortLabel
                    active={currentSortKey === (column.sortKey || column.id)}
                    direction={currentSortDir === 'none' ? 'asc' : currentSortDir}
                    onClick={createSortHandler(column.sortKey || column.id)}
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

      {/* Body */}
      <TableBody>
        {(assets || []).map((row: any) => (
          <TableRow key={`${row.group_1}-${row.relation}`}>
            {visibleColumns.map((col) => {
              if (col.id === 'thumbnail') {
                const t = thumbs[row.group_1] || 'No Thumbnail';
                return <TableCell key={col.id}>{t}</TableCell>;
              }
              return <TableCell key={col.id}>{row[col.id] ?? '-'}</TableCell>;
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default AssetsDataTable;
