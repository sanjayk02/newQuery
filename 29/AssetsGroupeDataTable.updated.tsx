import React, { useMemo, useState, useCallback } from 'react';
import { Box, Typography, IconButton } from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { Asset } from './types';

type PivotGroup = {
  top_group_node: string;
  items: Asset[];
};

type Props = {
  /**
   * Groups returned by the backend when view=grouped.
   * Each group contains items for the *current page*.
   */
  groups?: PivotGroup[];

  /**
   * Fallback when groups are not provided (older code-path).
   */
  assets?: Asset[];

  /**
   * 0-based UI page index (MUI).
   */
  page?: number;

  /**
   * Pinned top nodes to show in a fixed order.
   * Default: Camera / Character / Prop / Set.
   */
  pinnedTopGroups?: string[];

  /**
   * How pinned groups behave when they have 0 items for the current page:
   * - 'firstPageOnly' (default): show pinned groups as empty only on page 0 (ShotGrid-ish)
   * - 'always': always show pinned groups even if empty
   * - 'never': never show empty pinned groups (only show if they have items)
   */
  pinnedEmptyVisibility?: 'firstPageOnly' | 'always' | 'never';

  /**
   * If true (default), any top_group_node that is not in pinnedTopGroups
   * will be merged under a single "Other" section (ShotGrid-ish).
   */
  mergeNonPinnedIntoOther?: boolean;

  /** Label used when mergeNonPinnedIntoOther=true */
  otherLabel?: string;
};

const DEFAULT_PINNED_TOP_GROUPS = ['camera', 'character', 'prop', 'set'];

const normalizeKey = (v: string) => (v || '').trim().toLowerCase();
const displayKey = (v: string) => (v || '').trim().toUpperCase();

const AssetsGroupedDataTable: React.FC<Props> = ({
  assets = [],
  groups = [],
  page = 0,
  pinnedTopGroups = DEFAULT_PINNED_TOP_GROUPS,
  pinnedEmptyVisibility = 'firstPageOnly',
  mergeNonPinnedIntoOther = true,
  otherLabel = 'Other',
}) => {
  // Collapsed state keyed by normalized top group node.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = useCallback((key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const grouped = useMemo(() => {
    // 1) Prefer server groups (authoritative for pagination)
    const serverMap: Record<string, Asset[]> = {};
    (groups || []).forEach((g) => {
      const k = normalizeKey(g.top_group_node || 'unassigned') || 'unassigned';
      serverMap[k] = Array.isArray(g.items) ? g.items : [];
    });

    // 2) Fallback: group a flat list of assets (older code path)
    const clientMap: Record<string, Asset[]> = {};
    (assets || []).forEach((asset) => {
      const k = normalizeKey(asset.top_group_node || 'unassigned') || 'unassigned';
      if (!clientMap[k]) clientMap[k] = [];
      clientMap[k].push(asset);
    });

    let map: Record<string, Asset[]> =
      Object.keys(serverMap).length > 0 ? serverMap : clientMap;

    const pinned = (pinnedTopGroups || []).map(normalizeKey).filter(Boolean);

    const shouldShowEmptyPinned = (itemsLen: number) => {
      if (itemsLen > 0) return true;
      if (pinnedEmptyVisibility === 'always') return true;
      if (pinnedEmptyVisibility === 'never') return false;
      // firstPageOnly
      return page === 0;
    };

    // If requested, merge all non-pinned into a single "other" bucket.
    if (mergeNonPinnedIntoOther) {
      const otherKey = normalizeKey(otherLabel) || 'other';

      // Keep "unassigned" separate (so it can behave like ShotGrid's Unassigned)
      const unassignedKey = 'unassigned';

      const otherItems: Asset[] = [];
      Object.entries(map)
        .filter(([k]) => !pinned.includes(k) && k !== unassignedKey)
        .forEach(([, v]) => otherItems.push(...(v || [])));

      // Replace map with only pinned + (optional) unassigned + other
      const merged: Record<string, Asset[]> = {};
      pinned.forEach((k) => {
        merged[k] = map[k] || [];
      });

      if (map[unassignedKey]) merged[unassignedKey] = map[unassignedKey];

      merged[otherKey] = otherItems;
      map = merged;
    }

    // Build entries in fixed order for pinned groups
    const entries: Array<[string, Asset[]]> = [];
    pinned.forEach((k) => {
      const items = map[k] || [];
      if (shouldShowEmptyPinned(items.length)) entries.push([k, items]);
    });

    // Append any other groups (e.g. "other", "unassigned", etc.)
    Object.entries(map)
      .filter(([k]) => !pinned.includes(k))
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([k, v]) => entries.push([k, v]));

    return entries;
  }, [
    assets,
    groups,
    page,
    pinnedTopGroups,
    pinnedEmptyVisibility,
    mergeNonPinnedIntoOther,
    otherLabel,
  ]);

  return (
    <Box>
      {grouped.map(([groupName, groupAssets]) => {
        const key = normalizeKey(groupName || 'unassigned') || 'unassigned';
        const isCollapsed = !!collapsed[key];

        return (
          <Box key={key} mb={1}>
            {/* Group Header (ShotGrid-like) */}
            <Box
              px={1}
              py={0.25}
              display="flex"
              alignItems="center"
              style={{
                background: 'rgba(255,255,255,0.06)',
                borderBottom: '1px solid rgba(255,255,255,0.12)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => toggle(key)}
              role="button"
              aria-label={`Toggle ${groupName}`}
            >
              <IconButton
                size="small"
                style={{ padding: 4, marginRight: 4 }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(key);
                }}
              >
                {isCollapsed ? (
                  <ChevronRightIcon fontSize="small" />
                ) : (
                  <ExpandMoreIcon fontSize="small" />
                )}
              </IconButton>

              <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
                {displayKey(groupName)} ({(groupAssets || []).length})
              </Typography>
            </Box>

            {/* Asset rows */}
            {!isCollapsed && (
              <Box>
                {(groupAssets || []).length === 0 ? (
                  <Box px={2} py={0.75} style={{ opacity: 0.7 }}>
                    <Typography variant="body2">No assets</Typography>
                  </Box>
                ) : (
                  groupAssets.map((asset) => (
                    <Box
                      key={`${asset.group_1}-${asset.relation}`}
                      px={2}
                      py={0.75}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      <Typography variant="body2">{asset.group_1}</Typography>
                    </Box>
                  ))
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
