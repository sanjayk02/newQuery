// ============================================
// 1. ADD HELPER FUNCTION FOR NUMERIC TAKE SORTING
// ============================================

/**
 * Enhanced comparison for TAKE values - sorts numerically, with empty values at the end
 */
const enhancedCompareTake = (a: any, b: any, dir: SortDir): number => {
  const isAsc = dir === 'asc';
  
  const aEmpty = isEmptyValue(a);
  const bEmpty = isEmptyValue(b);
  
  // Rule: Empty values always go to the END
  if (aEmpty && bEmpty) return 0;
  if (aEmpty && !bEmpty) return 1;   // a empty, goes after b
  if (!aEmpty && bEmpty) return -1;  // a valid, goes before b
  
  // Both have values - parse as integers for numeric comparison
  const aNum = parseInt(String(a).trim(), 10);
  const bNum = parseInt(String(b).trim(), 10);
  
  // If both are valid numbers, compare numerically
  if (!isNaN(aNum) && !isNaN(bNum)) {
    if (aNum === bNum) return 0;
    
    if (isAsc) {
      return aNum < bNum ? -1 : 1;
    } else {
      return aNum > bNum ? -1 : 1;
    }
  }
  
  // Fallback to string comparison if numbers are invalid
  const compA = String(a).trim().toLowerCase();
  const compB = String(b).trim().toLowerCase();
  
  if (compA === compB) return 0;
  
  if (isAsc) {
    return compA < compB ? -1 : 1;
  } else {
    return compA > compB ? -1 : 1;
  }
};

// ============================================
// 2. UPDATE THE COLUMN DEFINITIONS - Ensure sortable is true
// ============================================
const columns: Column[] = [
  { id: "thumbnail", label: "Thumbnail" },
  { id: "group_1_name", label: "Name", sortable: true, sortKey: "group_1" },

  // MDL Phase
  { id: "mdl_work_status", label: "MDL WORK", colors: ASSET_PHASES.mdl, sortable: true, sortKey: "mdl_work" },
  { id: "mdl_approval_status", label: "MDL APPR", colors: ASSET_PHASES.mdl, sortable: true, sortKey: "mdl_appr" },
  { id: "mdl_submitted_at", label: "MDL Submitted At", colors: ASSET_PHASES.mdl, sortable: true, sortKey: "mdl_submitted" },
  { id: "mdl_take", label: "MDL TAKE", colors: ASSET_PHASES.mdl, sortable: true, sortKey: "mdl_take" },  // Already sortable

  // RIG Phase
  { id: "rig_work_status", label: "RIG WORK", colors: ASSET_PHASES.rig, sortable: true, sortKey: "rig_work" },
  { id: "rig_approval_status", label: "RIG APPR", colors: ASSET_PHASES.rig, sortable: true, sortKey: "rig_appr" },
  { id: "rig_submitted_at", label: "RIG Submitted At", colors: ASSET_PHASES.rig, sortable: true, sortKey: "rig_submitted" },
  { id: "rig_take", label: "RIG TAKE", colors: ASSET_PHASES.rig, sortable: true, sortKey: "rig_take" },

  // BLD Phase
  { id: "bld_work_status", label: "BLD WORK", colors: ASSET_PHASES.bld, sortable: true, sortKey: "bld_work" },
  { id: "bld_approval_status", label: "BLD APPR", colors: ASSET_PHASES.bld, sortable: true, sortKey: "bld_appr" },
  { id: "bld_submitted_at", label: "BLD Submitted At", colors: ASSET_PHASES.bld, sortable: true, sortKey: "bld_submitted" },
  { id: "bld_take", label: "BLD TAKE", colors: ASSET_PHASES.bld, sortable: true, sortKey: "bld_take" },

  // DSN Phase
  { id: "dsn_work_status", label: "DSN WORK", colors: ASSET_PHASES.dsn, sortable: true, sortKey: "dsn_work" },
  { id: "dsn_approval_status", label: "DSN APPR", colors: ASSET_PHASES.dsn, sortable: true, sortKey: "dsn_appr" },
  { id: "dsn_submitted_at", label: "DSN Submitted At", colors: ASSET_PHASES.dsn, sortable: true, sortKey: "dsn_submitted" },
  { id: "dsn_take", label: "DSN TAKE", colors: ASSET_PHASES.dsn, sortable: true, sortKey: "dsn_take" },

  // LDV Phase
  { id: "ldv_work_status", label: "LDV WORK", colors: ASSET_PHASES.ldv, sortable: true, sortKey: "ldv_work" },
  { id: "ldv_approval_status", label: "LDV APPR", colors: ASSET_PHASES.ldv, sortable: true, sortKey: "ldv_appr" },
  { id: "ldv_submitted_at", label: "LDV Submitted At", colors: ASSET_PHASES.ldv, sortable: true, sortKey: "ldv_submitted" },
  { id: "ldv_take", label: "LDV TAKE", colors: ASSET_PHASES.ldv, sortable: true, sortKey: "ldv_take" },

  { id: "relation", label: "Relation", sortable: true, sortKey: "relation" },
];

// ============================================
// 3. UPDATE THE RECORDTABLEHEAD COMPONENT
// ============================================
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
            ? [`${phase}_work_status`, `${phase}_approval_status`, `${phase}_submitted_at`, `${phase}_take`]
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
                cursor: column.sortable ? "pointer" : "default",
              }}
              onClick={column.sortable ? createSortHandler(sortKey) : undefined}
            >
              {column.sortable ? (
                <Box display="flex" alignItems="center" justifyContent="center">
                  <span style={{ fontSize: 12, fontWeight: 500 }}>
                    {column.label}
                  </span>
                  <Box ml={0.5} display="inline-flex" alignItems="center">
                    {sortDir !== "none" && (
                      <span style={{ 
                        fontSize: 12,
                        color: '#fcfeffff',
                        lineHeight: '12px',
                        marginLeft: 2,
                        fontWeight: 'bold'
                      }}>
                        {sortDir === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </Box>
                </Box>
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