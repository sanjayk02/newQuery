import React, { useMemo, useState, useCallback } from 'react';
import { Box, Typography, IconButton } from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { Asset, PivotGroup, SortDir } from './types';

type Props = {
  /** Groups returned by the backend when view=grouped */
  groups?: PivotGroup[];
  /** 0-based UI page index (asset-based pagination in grouped view) */
  page: number;
  /** Assets per page */
  rowsPerPage: number;

  /** Current UI sort key */
  sortKey: string;
  /** Current UI sort direction */
  sortDir: SortDir;

  /**
   * If true, UNASSIGNED (null/empty/'unassigned') group is forced to the top.
   * If false, it is sorted like a normal group name.
   */
  unassignedFirst?: boolean;
};

const normalizeGroupName = (v: string | null | undefined) => (v ?? 'unassigned').trim().toLowerCase();

const displayKey = (v: string | null | undefined) => (v ?? 'UNASSIGNED').trim().toUpperCase();

const AssetsGroupedDataTable: React.FC<Props> = ({
  groups = [],
  page,
  rowsPerPage,
  sortKey,
  sortDir,
  unassignedFirst = false,
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = useCallback((key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  /**
   * ShotGrid-like behavior:
   * - Group headers are ordered alphabetically A→Z (or Z→A when sorting on the group column).
   * - When sorting on any other column, group order stays A→Z and items inside each group are sorted.
   * - Grouped pagination is asset-based (rowsPerPage = number of assets rendered, not counting headers).
   */
  const pageGroups = useMemo(() => {
    const isGroupSort = sortKey === 'group_1_name' || sortKey === 'top_group_node' || sortKey === 'group_1';

    // group header sort direction:
    // - if user is sorting group column -> follow sortDir
    // - else default A→Z
    const groupDir: SortDir = isGroupSort ? sortDir : 'asc';
    const groupAsc = groupDir !== 'desc';

    // 1) order groups (alphabetical) with optional UNASSIGNED first
    const orderedGroups = [...groups].sort((a, b) => {
      const aName = normalizeGroupName(a.top_group_node);
      const bName = normalizeGroupName(b.top_group_node);

      if (unassignedFirst) {
        const aIsUn = aName === 'unassigned' || aName === '';
        const bIsUn = bName === 'unassigned' || bName === '';
        if (aIsUn && !bIsUn) return -1;
        if (!aIsUn && bIsUn) return 1;
      }

      const cmp = aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'base' });
      return groupAsc ? cmp : -cmp;
    });

    // 2) sort items within each group (only when sorting a non-group column)
    const itemSortKey = sortKey === 'group_1_name' ? 'group_1' : sortKey;

    const sortedGroups = orderedGroups.map((g) => {
      const items = Array.isArray(g.items) ? g.items : [];
      if (sortDir === 'none' || isGroupSort) return { ...g, items };

      const asc = sortDir === 'asc';

      const sortedItems = [...items].sort((a: any, b: any) => {
        const va = (a?.[itemSortKey] ?? '').toString().toLowerCase();
        const vb = (b?.[itemSortKey] ?? '').toString().toLowerCase();

        // Empty/placeholder values at the bottom
        const aEmpty = va === '' || va === '-';
        const bEmpty = vb === '' || vb === '-';
        if (aEmpty && !bEmpty) return 1;
        if (!aEmpty && bEmpty) return -1;

        const c = va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' });
        return asc ? c : -c;
      });

      return { ...g, items: sortedItems };
    });

    // 3) asset-based pagination across groups (do NOT count headers)
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;

    // Flatten items with group context in the already-ordered group order
    const flattened: Array<{ group: PivotGroup; groupKey: string; asset: Asset }> = [];
    for (const g of sortedGroups) {
      const gKey = normalizeGroupName(g.top_group_node);
      for (const a of g.items || []) flattened.push({ group: g, groupKey: gKey, asset: a });
    }

    const pageSlice = flattened.slice(start, end);

    // Rebuild groups for this page, preserving order as they first appear in the slice
    const byKey = new Map<string, { group: PivotGroup; items: Asset[] }>();
    const order: string[] = [];

    for (const row of pageSlice) {
      if (!byKey.has(row.groupKey)) {
        byKey.set(row.groupKey, { group: row.group, items: [] });
        order.push(row.groupKey);
      }
      byKey.get(row.groupKey)!.items.push(row.asset);
    }

    return order.map((k) => {
      const entry = byKey.get(k)!;
      return {
        ...entry.group,
        items: entry.items,
      };
    });
  }, [groups, page, rowsPerPage, sortKey, sortDir, unassignedFirst]);

  return (
    <Box width="100%">
      {pageGroups.map((group) => {
        const groupKey = normalizeGroupName(group.top_group_node);
        const groupName = group.top_group_node || 'unassigned';
        const isCollapsed = !!collapsed[groupKey];

        const shownItems = group.items || [];
        const totalInGroup = typeof group.total_count === 'number' ? group.total_count : shownItems.length;

        return (
          <Box key={groupKey} mb={0.5}>
            {/* Group Header */}
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
              onClick={() => toggle(groupKey)}
            >
              <IconButton size="small" style={{ padding: 4, marginRight: 8 }}>
                {isCollapsed ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>

              <Typography variant="subtitle2" style={{ fontWeight: 700, fontSize: '0.75rem' }}>
                {displayKey(groupName)}
                <span style={{ marginLeft: 8, color: '#00b7ff' }}>({totalInGroup})</span>
              </Typography>
            </Box>

            {/* Asset Rows */}
            {!isCollapsed && (
              <Box>
                {shownItems.map((asset) => (
                  <Box
                    key={`${groupKey}-${asset.relation ?? asset.id ?? asset.group_1 ?? Math.random()}`}
                    px={6}
                    py={0.75}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <Typography variant="body2" style={{ fontSize: '0.85rem' }}>
                      {asset.group_1}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export default AssetsGroupedDataTable;
