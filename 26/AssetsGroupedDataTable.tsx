import React, { useMemo } from 'react';
import { Box, Typography } from '@material-ui/core';
import { Asset } from './types';

type Props = {
  assets: Asset[];
};

const AssetsGroupedDataTable: React.FC<Props> = ({ assets }) => {
  const grouped = useMemo(() => {
    const map: Record<string, Asset[]> = {};

    assets.forEach((asset) => {
      const key =
        asset.top_group_node && asset.top_group_node.trim()
          ? asset.top_group_node
          : 'Unassigned';

      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(asset);
    });

    return Object.entries(map);
  }, [assets]);

  return (
    <Box>
      {grouped.map(([groupName, groupAssets]) => (
        <Box key={groupName} mb={2}>
          {/* Group Header */}
          <Box
            px={1}
            py={0.5}
            style={{
              background: 'rgba(255,255,255,0.06)',
              borderBottom: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <Typography
              variant="subtitle2"
              style={{ fontWeight: 700 }}
            >
              {groupName.toUpperCase()} ({groupAssets.length})
            </Typography>
          </Box>

          {/* Asset rows */}
          {groupAssets.map((asset) => (
            <Box
              key={`${asset.group_1}-${asset.relation}`}
              px={2}
              py={0.75}
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <Typography variant="body2">
                {asset.group_1}
              </Typography>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
};

export default AssetsGroupedDataTable;
