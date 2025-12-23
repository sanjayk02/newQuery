/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    AssetsRowTablePanel.tsx

  Module Description:
    Implementation for the "Assets Row" page with populated workflow data.
─────────────────────────────────────────────────────────────────────────── */

import React from 'react';
import {
  Box,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Collapse,
  styled,
} from '@material-ui/core';

import MenuIcon from '@material-ui/icons/Menu';
import ViewModuleIcon from '@material-ui/icons/ViewModule';
import ViewListIcon from '@material-ui/icons/ViewList';
import FilterListIcon from '@material-ui/icons/FilterList';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';

// -------------------- Sizing constants (IMPORTANT for alignment) --------------------
const GROUP_ROW_H = 32;  // left group header height
const ASSET_ROW_H = 44;  // left asset row height AND table asset row height

// --- Styled Components ---

const Root = styled(Container)(({ theme }) => ({
  position: 'relative',
  padding: 0,
  backgroundColor: '#1e1e1e',
  minHeight: '100vh',
  '& > *': {
    padding: theme.spacing(1),
  },
}));

const Toolbar = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: '#2d2d2d',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  padding: theme.spacing(1),
  height: 48,
  boxSizing: 'border-box',
}));

const ContentRow = styled('div')({
  display: 'flex',
  flexDirection: 'row',
  width: '100%',
  alignItems: 'stretch',
});

const LeftPanel = styled('div')({
  width: 260,
  minWidth: 260,
  backgroundColor: '#252525',
  borderRight: '1px solid rgba(255,255,255,0.12)',
  display: 'flex',
  flexDirection: 'column',
});

const LeftPanelHeader = styled('div')({
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingLeft: 12,
  paddingRight: 8,
  backgroundColor: '#2d2d2d',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
});

const LeftPanelBody = styled('div')({
  overflowY: 'auto',
  flex: 1,
});

const TableWrap = styled(Paper)({
  flex: 1,
  overflowX: 'auto',
  backgroundColor: '#1e1e1e',
  borderRadius: 0,
  boxShadow: 'none',
});

const HeaderCell = styled(TableCell)({
  fontWeight: 600,
  textTransform: 'uppercase',
  fontSize: 11,
  letterSpacing: 0.5,
  whiteSpace: 'nowrap',
  padding: '8px 10px',
  backgroundColor: '#2d2d2d !important',
  color: '#ffffff',
  borderBottom: '1px solid rgba(255,255,255,0.12)',
});

const DataCell = styled(TableCell)({
  color: '#b0b0b0',
  padding: '8px 10px',
  fontSize: 12,
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  height: ASSET_ROW_H,
  boxSizing: 'border-box',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
});

const GroupSpacerCell = styled(TableCell)({
  padding: 0,
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  height: GROUP_ROW_H,
  backgroundColor: '#1e1e1e',
});

const Thumb = styled('div')({
  width: 32,
  height: 24,
  borderRadius: 2,
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.2)',
  flex: '0 0 auto',
});

// Used in left panel asset items
const RowItem = styled('div')({
  display: 'flex',
  alignItems: 'center',
  height: ASSET_ROW_H,
  width: '100%',
  boxSizing: 'border-box',
  // ✅ bigger gap between thumb and name
  columnGap: 16,
});

// Used in table "Name" cell to align nicely
const NameCellWrap = styled('div')({
  display: 'flex',
  alignItems: 'center',
  columnGap: 12,
});

// --- Types & Constants ---

const HEADER_COLUMNS = [
  { id: 'thumbnail', label: 'Thumbnail', minWidth: 100 },
  { id: 'name', label: 'Name', minWidth: 150 },
  { id: 'mdl_work', label: 'MDL Work', minWidth: 100 },
  { id: 'mdl_appr', label: 'MDL Appr', minWidth: 100 },
  { id: 'mdl_submitted', label: 'MDL Submitted At', minWidth: 140 },
  { id: 'rig_work', label: 'RIG Work', minWidth: 100 },
  { id: 'rig_appr', label: 'RIG Appr', minWidth: 100 },
  { id: 'rig_submitted', label: 'RIG Submitted At', minWidth: 140 },
  { id: 'bld_work', label: 'BLD Work', minWidth: 100 },
  { id: 'bld_appr', label: 'BLD Appr', minWidth: 100 },
  { id: 'bld_submitted', label: 'BLD Submitted At', minWidth: 140 },
  { id: 'dsn_work', label: 'DSN Work', minWidth: 100 },
  { id: 'dsn_appr', label: 'DSN Appr', minWidth: 100 },
  { id: 'dsn_submitted', label: 'DSN Submitted At', minWidth: 140 },
  { id: 'ldv_work', label: 'LDV Work', minWidth: 100 },
  { id: 'ldv_appr', label: 'LDV Appr', minWidth: 100 },
  { id: 'ldv_submitted', label: 'LDV Submitted At', minWidth: 140 },
  { id: 'relation', label: 'Relation', minWidth: 90 },
];

type AssetRow = ReturnType<typeof generateMockData>;
type GroupRow = { id: string; label: string; count: number; assets: AssetRow[] };

/** Helper to generate mock workflow data for an asset */
function generateMockData(id: string, name: string) {
  return {
    id,
    name,
    mdl_work: Math.random() > 0.5 ? 'In Progress' : 'Done',
    mdl_appr: Math.random() > 0.5 ? 'Pending' : 'Approved',
    mdl_submitted: '2023-11-20',
    rig_work: 'In Progress',
    rig_appr: '—',
    rig_submitted: '—',
    bld_work: 'Waiting',
    bld_appr: '—',
    bld_submitted: '—',
    dsn_work: 'Done',
    dsn_appr: 'Approved',
    dsn_submitted: '2023-10-15',
    ldv_work: '—',
    ldv_appr: '—',
    ldv_submitted: '—',
    relation: 'Master',
  };
}

const MOCK_GROUPS: GroupRow[] = [
  {
    id: 'camera',
    label: 'camera',
    count: 3,
    assets: [
      generateMockData('camAim', 'camAim'),
      generateMockData('camHero', 'camHero'),
      generateMockData('camWide', 'camWide'),
    ],
  },
  {
    id: 'character',
    label: 'character',
    count: 4,
    assets: [
      generateMockData('ando', 'ando'),
      generateMockData('baseFemale', 'baseFemale'),
      generateMockData('baseMale', 'baseMale'),
      generateMockData('chris', 'chris'),
    ],
  },
  {
    id: 'fx',
    label: 'fx',
    count: 1,
    assets: [generateMockData('fx_smoke', 'fx_smoke')],
  },
  {
    id: 'other',
    label: 'other',
    count: 1,
    assets: [generateMockData('env_prop', 'env_prop')],
  },
];

// --- Main Component ---

const AssetsRowTablePanel: React.FC = () => {
  const [search, setSearch] = React.useState('');
  const [barView, setBarView] = React.useState<'list' | 'group'>('group');
  const [leftOpen, setLeftOpen] = React.useState(true);
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({
    camera: true,
    character: true,
    fx: true,
    other: true,
  });

  // Filter columns based on view mode
  const headerColumns = React.useMemo(() => {
    // group mode = table should NOT show thumbnail/name (they are in left panel)
    if (barView === 'group') {
      return HEADER_COLUMNS.filter((c) => c.id !== 'thumbnail' && c.id !== 'name');
    }
    // list mode = show full columns
    return HEADER_COLUMNS;
  }, [barView]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // search filter (simple)
  const filteredGroups = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MOCK_GROUPS;

    return MOCK_GROUPS.map((g) => ({
      ...g,
      assets: g.assets.filter((a) => a.name.toLowerCase().includes(q)),
    })).filter((g) => g.assets.length > 0);
  }, [search]);

  // Flatten for list mode (no group header rows in table)
  const flatAssets = React.useMemo(() => {
    return filteredGroups.flatMap((g) => g.assets.map((a) => ({ groupId: g.id, asset: a })));
  }, [filteredGroups]);

  const renderCell = (asset: AssetRow, colId: string) => {
    if (colId === 'thumbnail') {
      return <Thumb />;
    }
    if (colId === 'name') {
      return (
        <NameCellWrap>
          {/* keep name aligned nicely in list mode */}
          <Typography style={{ color: '#ddd', fontSize: 12 }}>{asset.name}</Typography>
        </NameCellWrap>
      );
    }

    const val = asset[colId as keyof AssetRow];
    if (val === '—') return <span style={{ opacity: 0.3 }}>—</span>;
    return val as any;
  };

  return (
    <Root maxWidth={false}>
      <Box>
        <Toolbar>
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <IconButton onClick={() => setBarView('list')} style={{ padding: 6 }}>
              <ViewListIcon style={{ fontSize: 18, color: barView === 'list' ? '#00b7ff' : '#b0b0b0' }} />
            </IconButton>
            <IconButton onClick={() => setBarView('group')} style={{ padding: 6 }}>
              <ViewModuleIcon style={{ fontSize: 18, color: barView === 'group' ? '#00b7ff' : '#b0b0b0' }} />
            </IconButton>

            {barView === 'group' && (
              <IconButton onClick={() => setLeftOpen((v) => !v)} style={{ padding: 6 }}>
                <MenuIcon style={{ fontSize: 18, color: '#fff' }} />
              </IconButton>
            )}

            <Typography variant="subtitle2" style={{ color: '#fff', marginLeft: 8 }}>
              Assets Row Table
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <TextField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Assets..."
              variant="outlined"
              size="small"
              InputProps={{ style: { height: 30, color: '#fff', fontSize: 12, backgroundColor: '#444' } }}
              style={{ width: 200 }}
            />
            <IconButton style={{ padding: 6 }}>
              <FilterListIcon style={{ fontSize: 18, color: '#b0b0b0' }} />
            </IconButton>
          </Box>
        </Toolbar>

        <ContentRow>
          {/* LEFT PANEL: Group Tree */}
          {barView === 'group' && leftOpen && (
            <LeftPanel>
              <LeftPanelHeader>
                <Typography variant="caption" style={{ color: '#fff', fontWeight: 600 }}>
                  Groups
                </Typography>
                <Typography variant="caption" style={{ color: '#666' }}>
                  (mock)
                </Typography>
              </LeftPanelHeader>

              <LeftPanelBody>
                <List dense disablePadding>
                  {filteredGroups.map((g) => {
                    const isOpen = !!openGroups[g.id];

                    return (
                      <React.Fragment key={g.id}>
                        <ListItem
                          button
                          onClick={() => toggleGroup(g.id)}
                          style={{ height: GROUP_ROW_H, paddingLeft: 12, paddingRight: 8 }}
                        >
                          <ListItemText
                            primary={`${g.label} (${g.count})`}
                            primaryTypographyProps={{ style: { fontSize: 12, color: '#fff', fontWeight: 600 } }}
                          />
                          {isOpen ? (
                            <ExpandLessIcon style={{ color: '#666' }} />
                          ) : (
                            <ExpandMoreIcon style={{ color: '#666' }} />
                          )}
                        </ListItem>

                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                          {g.assets.map((a) => (
                            <ListItem
                              key={a.id}
                              button
                              style={{
                                paddingLeft: 18,
                                paddingRight: 10,
                                height: ASSET_ROW_H,
                              }}
                            >
                              <RowItem>
                                <Thumb />
                                <Typography style={{ color: '#ddd', fontSize: 12 }}>{a.name}</Typography>
                              </RowItem>
                            </ListItem>
                          ))}
                        </Collapse>
                      </React.Fragment>
                    );
                  })}
                </List>
              </LeftPanelBody>
            </LeftPanel>
          )}

          {/* RIGHT PANEL: Data Table */}
          <TableWrap>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {headerColumns.map((c) => (
                    <HeaderCell key={c.id} style={{ minWidth: c.minWidth }}>
                      {c.label}
                    </HeaderCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {/* ✅ LIST MODE: NO group header rows, only assets */}
                {barView === 'list' &&
                  flatAssets.map(({ asset }) => (
                    <TableRow key={asset.id} hover style={{ height: ASSET_ROW_H }}>
                      {headerColumns.map((col) => (
                        <DataCell key={col.id}>{renderCell(asset, col.id)}</DataCell>
                      ))}
                    </TableRow>
                  ))}

                {/* ✅ GROUP MODE: add spacer row per group to match left panel group header height */}
                {barView === 'group' &&
                  filteredGroups.map((group) => {
                    const isOpen = !!openGroups[group.id];

                    return (
                      <React.Fragment key={group.id}>
                        {/* spacer row aligns with left group header */}
                        <TableRow style={{ height: GROUP_ROW_H }}>
                          <GroupSpacerCell colSpan={headerColumns.length} />
                        </TableRow>

                        {/* asset rows align with left asset rows */}
                        {isOpen &&
                          group.assets.map((asset) => (
                            <TableRow key={asset.id} hover style={{ height: ASSET_ROW_H }}>
                              {headerColumns.map((col) => (
                                <DataCell key={col.id}>{renderCell(asset, col.id)}</DataCell>
                              ))}
                            </TableRow>
                          ))}
                      </React.Fragment>
                    );
                  })}
              </TableBody>
            </Table>
          </TableWrap>
        </ContentRow>
      </Box>
    </Root>
  );
};

export default AssetsRowTablePanel;
