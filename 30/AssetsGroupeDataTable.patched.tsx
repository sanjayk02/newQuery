import React, { useMemo, useState, useCallback } from 'react';
import { Box, Typography, IconButton } from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { Asset, PivotGroup, SortDir } from './types';


// Default fixed order as shown in the "Before Sorted" screenshot
const DEFAULT_PINNED_ORDER = [
  'unassigned',
  'camera',
  'character',
  'test',
  'set',
  'prop',
  'light',
  'fx',
  'creature',
];

const normalizeGroupKey = (v: string | null | undefined) => (v || 'unassigned').trim().toLowerCase();
const displayGroupKey = (v: string | null | undefined) => (v || 'UNASSIGNED').trim().toUpperCase();

const resolveItemSortField = (uiKey: string): keyof Asset | null => {
  if (!uiKey) return null;
  if (uiKey === 'group_1' || uiKey === 'relation') return uiKey;

  const m = uiKey.match(/^(mdl|rig|bld|dsn|ldv)_(work|appr|submitted)$/i);
  if (!m) return null;

  const phase = m[1].toLowerCase();
  const field = m[2].toLowerCase();

  if (field === 'work') return `${phase}_work_status` as keyof Asset;
  if (field === 'appr') return `${phase}_approval_status` as keyof Asset;
  return `${phase}_submitted_at_utc` as keyof Asset;
};

const isEmptySortVal = (v: unknown) => v == null || v === '' || v === '-';

type Props = {
  /** Groups returned by the backend when view=grouped */
  groups?: PivotGroup[];
  /** 0-based UI page index */
  page: number;
  /** Rows per page setting */
  rowsPerPage: number;

  /** Client-side sort key for items within each group (from the table header). */
  sortKey: string;
  /** Client-side sort direction for items within each group. */
  sortDir: SortDir;

  /** Pinned top nodes to show in a fixed order */
  pinnedTopGroups?: string[];
};

const DEFAULT_PINNED_TOP_GROUPS = ['camera', 'character', 'prop', 'set'];

const displayKey = (v: string) => (v || '').trim().toUpperCase();

const AssetsGroupedDataTable: React.FC<Props> = ({
  groups = [],
  page,
  rowsPerPage,
  pinnedTopGroups = DEFAULT_PINNED_TOP_GROUPS,
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = useCallback((key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  /**
   * Internal Sorting Logic:
   * We keep the top nodes fixed but sort the items inside each group 
   * to ensure assets are easy to find (e.g., A-Z).
   */
  const processedGroups = useMemo(() => {
    // 1) Fixed group order (pinned first, then alpha)
    const orderedGroups = [...groups].sort((a, b) => {
      const aKey = normalizeGroupKey(a.top_group_node);
      const bKey = normalizeGroupKey(b.top_group_node);

      const aIdx = pinnedTopGroups.indexOf(aKey);
      const bIdx = pinnedTopGroups.indexOf(bKey);

      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return aKey.localeCompare(bKey, undefined, { numeric: true });
    });

    // 2) Sort items *within* each group by the current UI sort
    const field = resolveItemSortField(sortKey);

    return orderedGroups.map((group) => {
      const items = [...(group.items || [])];

      // If no sort (or unknown key), keep backend order.
      if (!field || sortDir === 'none') return { ...group, items };

      const isAsc = sortDir === 'asc';

      items.sort((a, b) => {
        const va = (a as any)[field];
        const vb = (b as any)[field];

        // Keep empty values at the bottom
        const aEmpty = isEmptySortVal(va);
        const bEmpty = isEmptySortVal(vb);
        if (aEmpty && bEmpty) return 0;
        if (aEmpty) return 1;
        if (bEmpty) return -1;

        // Submitted dates: compare as ISO strings (safe, since server returns UTC ISO)
        if (String(field).endsWith('_submitted_at_utc')) {
          const ca = String(va);
          const cb = String(vb);
          const comp = ca.localeCompare(cb);
          return isAsc ? comp : -comp;
        }

        const sa = String(va).toLowerCase();
        const sb = String(vb).toLowerCase();
        const comp = sa.localeCompare(sb, undefined, { numeric: true });
        return isAsc ? comp : -comp;
      });

      return { ...group, items };
    });
  }, [groups, sortKey, sortDir, pinnedTopGroups]);

  return (
    <Box width="100%">
      {processedGroups.map((group, index) => {
        const groupName = group.top_group_node || 'unassigned';
        const isCollapsed = !!collapsed[groupName];
        const groupItems = group.items || [];
        
        /** * ShotGrid Logic for Pagination:
         * - isContinued: If this is the first group on any page after page 1.
         * - willContinue: If the group is full, indicating more exists on the next page.
         */
        const isContinued = page > 0 && index === 0;
        const willContinue = groupItems.length === rowsPerPage;

        return (
          <Box key={groupName} mb={0.5}>
            {/* Group Header (Fixed Node) */}
            <Box
              px={1}
              py={0.5}
              display="flex"
              alignItems="center"
              style={{
                background: 'rgba(255,255,255,0.08)',
                borderBottom: '1px solid rgba(255,255,255,0.12)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => toggle(groupName)}
            >
              <IconButton size="small" style={{ padding: 4, marginRight: 8 }}>
                {isCollapsed ? (
                  <ChevronRightIcon fontSize="small" />
                ) : (
                  <ExpandMoreIcon fontSize="small" />
                )}
              </IconButton>

              <Typography variant="subtitle2" style={{ fontWeight: 700, fontSize: '0.75rem' }}>
                {displayKey(groupName)} 
                {isContinued && (
                  <span style={{ opacity: 0.5, marginLeft: 8, fontWeight: 400 }}>(continued)</span>
                )}
                <span style={{ marginLeft: 8, color: '#00b7ff' }}>({groupItems.length})</span>
              </Typography>
            </Box>

            {/* Asset Rows (Sorted Items) */}
            {!isCollapsed && (
              <Box>
                {groupItems.length === 0 ? (
                  <Box px={6} py={0.5} style={{ opacity: 0.5 }}>
                    <Typography variant="caption">No assets</Typography>
                  </Box>
                ) : (
                  groupItems.map((asset) => (
                    <Box
                      key={`${asset.group_1}-${asset.relation}`}
                      px={6}
                      py={0.75}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        backgroundColor: 'transparent'
                      }}
                    >
                      <Typography variant="body2" style={{ fontSize: '0.85rem' }}>
                        {asset.group_1}
                      </Typography>
                    </Box>
                  ))
                )}
                {willContinue && (
                  <Box px={6} py={0.5}>
                    <Typography variant="caption" style={{ color: '#888', fontStyle: 'italic' }}>
                      More assets in {displayKey(groupName)} on next page...
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export default AssetsGroupedDataTable;