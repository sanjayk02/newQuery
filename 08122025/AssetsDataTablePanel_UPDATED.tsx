// UPDATED AssetsDataTablePanel.tsx
import React from 'react';
import AssetTableFilter from './AssetDataTableFilter';
import ViewListIcon from '@material-ui/icons/ViewList';
import ViewModuleIcon from '@material-ui/icons/ViewModule';
import IconButton from '@material-ui/core/IconButton';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import FilterListIcon from '@material-ui/icons/FilterList';

export default function AssetsDataTablePanel() {
  const [barView, setBarView] = React.useState('list');

  const viewToggle = (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      <IconButton size="small" onClick={() => setBarView('list')}>
        <ViewListIcon />
      </IconButton>
      <IconButton size="small" onClick={() => setBarView('grid')}>
        <ViewModuleIcon />
      </IconButton>
    </div>
  );

  const searchAndFilter = (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <TextField size="small" placeholder="Search Assets..." />
      <Button size="small" variant="contained" color="primary" startIcon={<FilterListIcon />}>
        Filter
      </Button>
    </div>
  );

  return (
    <AssetTableFilter
      showInlineFilters={false}
      headerLeft={viewToggle}
      headerRight={searchAndFilter}
      onResetClick={() => {}}
      hiddenColumns={new Set()}
      onHiddenColumnsChange={() => {}}
      onToggleColumn={() => {}}
      onShowAll={() => {}}
      onHideAll={() => {}}
      visibleCount={0}
    />
  );
}
