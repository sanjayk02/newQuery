// UPDATED AssetDataTableFilter.tsx
import React from 'react';
import { Button } from '@material-ui/core';

type Props = {
  showInlineFilters?: boolean;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  onResetClick: () => void;
  hiddenColumns: Set<string>;
  onHiddenColumnsChange: (s: Set<string>) => void;
  onToggleColumn: (id: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  visibleCount: number;
};

export default function AssetTableFilter({
  headerLeft,
  headerRight,
  onResetClick,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        background: '#3d3d3d',
      }}
    >
      <div>{headerLeft}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {headerRight}
        <Button size="small" variant="outlined">
          COLUMNS
        </Button>
        <Button size="small" variant="outlined" onClick={onResetClick}>
          RESET
        </Button>
      </div>
    </div>
  );
}
