/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    AssetsRowTablePanel.tsx

  Module Description:
    Assets Row table with:
      ✅ Proper left alignment (no “top group row” shifting)
      ✅ List mode: NO group header rows (CAMERA/CHARACTER removed)
      ✅ Gap between thumbnail and name (sidebar + table)
      ✅ Column “Groups / Boxes” (MDL / RIG / BLD / DSN / LDV) header bands
      ✅ No TableContainer usage (fixes “TableContainer not exported” error)
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

// ──────────────────────────────────────────────────────────────────────────
// Styled
// ──────────────────────────────────────────────────────────────────────────

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

// Header sizes (important for sticky top offsets)
const GROUP_HEADER_H = 30;
const COL_HEADER_H = 34;

const HeaderCell = styled(TableCell)({
  fontWeight: 700,
  textTransform: 'uppercase',
  fontSize: 11,
  letterSpacing: 0.5,
  whiteSpace: 'nowrap',
  padding: '8px 10px',
  backgroundColor: '#2d2d2d !important',
  color: '#ffffff',
  borderBottom: '1px solid rgba(255,255,255,0.12)',
});

const GroupBandCell = styled(TableCell)({
  fontWeight: 800,
  textTransform: 'uppercase',
  fontSize: 11,
  letterSpacing: 0.6,
  whiteSpace: 'nowrap',
  padding: '6px 10px',
  backgroundColor: '#2d2d2d !important',
  color: '#ffffff',
  borderBottom: '1px solid rgba(255,255,255,0.12)',
});

const DataCell = styled(TableCell)({
  color: '#b0b0b0',
  padding: '8px 10px',
  fontSize: 12,
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  height: 44,
  boxSizing: 'border-box',
  verticalAlign: 'middle',
});

const Thumb = styled('div')({
  width: 32,
  height: 24,
  borderRadius: 2,
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.2)',
  flex: '0 0 auto',
});

const RowItem = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: 10, // ✅ gap between thumb and name
  height: 28,
});

// ──────────────────────────────────────────────────────────────────────────
// Types & Constants
// ──────────────────────────────────────────────────────────────────────────

type Col = { id: string; label: string; minWidth: number; align?: 'left' | 'right' | 'center' };

const HEADER_COLUMNS: Col[] = [
  { id: 'thumbnail', label: 'Thumbnail', minWidth: 120 },
  { id: 'name', label: 'Name', minWidth: 190 },

  { id: 'mdl_work', label: 'MDL Work', minWidth: 110 },
  { id: 'mdl_appr', label: 'MDL Appr', minWidth: 110 },
  { id: 'mdl_submitted', label: 'MDL Submitted At', minWidth: 150 },

  { id: 'rig_work', label: 'RIG Work', minWidth: 110 },
  { id: 'rig_appr', label: 'RIG Appr', minWidth: 110 },
  { id: 'rig_submitted', label: 'RIG Submitted At', minWidth: 150 },

  { id: 'bld_work', label: 'BLD Work', minWidth: 110 },
  { id: 'bld_appr', label: 'BLD Appr', minWidth: 110 },
  { id: 'bld_submitted', label: 'BLD Submitted At', minWidth: 150 },

  { id: 'dsn_work', label: 'DSN Work', minWidth: 110 },
  { id: 'dsn_appr', label: 'DSN Appr', minWidth: 110 },
  { id: 'dsn_submitted', label: 'DSN Submitted At', minWidth: 150 },

  { id: 'ldv_work', label: 'LDV Work', minWidth: 110 },
  { id: 'ldv_appr', label: 'LDV Appr', minWidth: 110 },
  { id: 'ldv_submitted', label: 'LDV Submitted At', minWidth: 150 },

  { id: 'relation', label: 'Relation', minWidth: 110 },
];

type AssetRow = {
  id: string;
  name: string;
  mdl_work: string;
  mdl_appr: string;
  mdl_submitted: string;
  rig_work: string;
  rig_appr: string;
  rig_submitted: string;
  bld_work: string;
  bld_appr: string;
  bld_submitted: string;
  dsn_work: string;
  dsn_appr: string;
  dsn_submitted: string;
  ldv_work: string;
  ldv_appr: string;
  ldv_submitted: string;
  relation: string;
};

const generateMockData = (id: string, name: string): AssetRow => ({
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
});

const MOCK_GROUPS = [
  {
    id: 'camera',
    label: 'camera',
    count: 3,
    assets: [generateMockData('camAim', 'camAim'), generateMockData('camHero', 'camHero'), generateMockData('camWide', 'camWide')],
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
  { id: 'fx', label: 'fx', count: 1, assets: [generateMockData('fx_smoke', 'fx_smoke')] },
  { id: 'other', label: 'other', count: 1, assets: [generateMockData('env_prop', 'env_prop')] },
];

const PHASE_GROUPS = [
  { key: 'mdl', label: 'MDL', colIds: ['mdl_work', 'mdl_appr', 'mdl_submitted'], border: '#2e86ff' },
  { key: 'rig', label: 'RIG', colIds: ['rig_work', 'rig_appr', 'rig_submitted'], border: '#7c3aed' },
  { key: 'bld', label: 'BLD', colIds: ['bld_work', 'bld_appr', 'bld_submitted'], border: '#ff2d7a' },
  { key: 'dsn', label: 'DSN', colIds: ['dsn_work', 'dsn_appr', 'dsn_submitted'], border: '#00c7b7' },
  { key: 'ldv', label: 'LDV', colIds: ['ldv_work', 'ldv_appr', 'ldv_submitted'], border: '#ffcc00' },
];

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

const normalize = (v: unknown) => (v === '—' ? '—' : String(v ?? ''));

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

  const toggleGroup = (id: string) => setOpenGroups((p) => ({ ...p, [id]: !p[id] }));

  // In GROUP mode => hide thumbnail+name from table (because name is in left panel)
  const visibleColumns: Col[] = React.useMemo(() => {
    if (barView === 'group') return HEADER_COLUMNS.filter((c) => c.id !== 'thumbnail' && c.id !== 'name');
    return HEADER_COLUMNS;
  }, [barView]);

  const filteredGroups = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MOCK_GROUPS;

    return MOCK_GROUPS.map((g) => ({
      ...g,
      assets: g.assets.filter((a) => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)),
    })).filter((g) => g.assets.length > 0);
  }, [search]);

  // ✅ List mode: flatten assets (NO group header rows)
  const listModeRows = React.useMemo(() => {
    const rows: AssetRow[] = [];
    filteredGroups.forEach((g) => g.assets.forEach((a) => rows.push(a)));
    return rows;
  }, [filteredGroups]);

  // ✅ Group mode: only include open groups (right table stays aligned to left list)
  const groupModeRows = React.useMemo(() => {
    const rows: AssetRow[] = [];
    filteredGroups.forEach((g) => {
      const isOpen = !!openGroups[g.id];
      if (isOpen) g.assets.forEach((a) => rows.push(a));
    });
    return rows;
  }, [filteredGroups, openGroups]);

  const rowsToRender = barView === 'group' ? groupModeRows : listModeRows;

  // Sticky header cell style helper
  const stickyStyle = (top: number) =>
    ({
      position: 'sticky',
      top,
      zIndex: 5,
    }) as React.CSSProperties;

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
          {/* LEFT PANEL (only for group mode) */}
          {barView === 'group' && leftOpen && (
            <LeftPanel>
              <LeftPanelHeader>
                <Typography variant="caption" style={{ color: '#fff', fontWeight: 700 }}>
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
                        <ListItem button onClick={() => toggleGroup(g.id)} style={{ height: 32 }}>
                          <ListItemText
                            primary={`${g.label} (${g.assets.length})`}
                            primaryTypographyProps={{ style: { fontSize: 12, color: '#fff', fontWeight: 700 } }}
                          />
                          {isOpen ? <ExpandLessIcon style={{ color: '#666' }} /> : <ExpandMoreIcon style={{ color: '#666' }} />}
                        </ListItem>

                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                          {g.assets.map((a) => (
                            <ListItem
                              key={a.id}
                              button
                              style={{
                                paddingLeft: 22,
                                height: 44,
                              }}
                            >
                              {/* ✅ gap between thumb and name */}
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

          {/* RIGHT PANEL: TABLE */}
          <TableWrap>
            <Table size="small" stickyHeader>
              <TableHead>
                {/* ── Header Row 1: Column "Groups / Boxes" (MDL/RIG/...) ── */}
                <TableRow style={{ height: GROUP_HEADER_H }}>
                  {/* Thumbnail/Name area */}
                  {barView === 'list' ? (
                    <>
                      <GroupBandCell style={{ ...stickyStyle(0), height: GROUP_HEADER_H }} colSpan={2}>
                        {/* empty band over thumb+name */}
                      </GroupBandCell>
                    </>
                  ) : (
                    <GroupBandCell style={{ ...stickyStyle(0), height: GROUP_HEADER_H }} colSpan={0 as any} />
                  )}

                  {PHASE_GROUPS.map((g) => (
                    <GroupBandCell
                      key={g.key}
                      colSpan={g.colIds.length}
                      style={{
                        ...stickyStyle(0),
                        height: GROUP_HEADER_H,
                        borderTop: `2px solid ${g.border}`,
                        borderLeft: `2px solid ${g.border}`,
                        borderRight: `2px solid ${g.border}`,
                        textAlign: 'left',
                      }}
                    >
                      {g.label}
                    </GroupBandCell>
                  ))}

                  <GroupBandCell style={{ ...stickyStyle(0), height: GROUP_HEADER_H, textAlign: 'left' }} colSpan={1}>
                    RELATION
                  </GroupBandCell>
                </TableRow>

                {/* ── Header Row 2: Actual column titles ── */}
                <TableRow style={{ height: COL_HEADER_H }}>
                  {visibleColumns.map((c) => (
                    <HeaderCell
                      key={c.id}
                      style={{
                        ...stickyStyle(GROUP_HEADER_H),
                        height: COL_HEADER_H,
                        minWidth: c.minWidth,
                      }}
                    >
                      {c.label}
                    </HeaderCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {/* ✅ List mode: NO group header rows. Just flat rows */}
                {rowsToRender.map((asset) => (
                  <TableRow key={asset.id} hover>
                    {visibleColumns.map((col) => {
                      // Thumbnail + Name rendering for LIST mode
                      if (barView === 'list' && col.id === 'thumbnail') {
                        return (
                          <DataCell key={col.id}>
                            <RowItem style={{ gap: 10 }}>
                              <Thumb />
                              <Typography style={{ color: '#ddd', fontSize: 12 }}> </Typography>
                            </RowItem>
                          </DataCell>
                        );
                      }

                      if (barView === 'list' && col.id === 'name') {
                        return (
                          <DataCell key={col.id} style={{ color: '#ddd' }}>
                            {asset.name}
                          </DataCell>
                        );
                      }

                      const val = normalize((asset as any)[col.id]);
                      return (
                        <DataCell key={col.id}>
                          {val === '—' ? <span style={{ opacity: 0.3 }}>—</span> : val}
                        </DataCell>
                      );
                    })}
                  </TableRow>
                ))}

                {rowsToRender.length === 0 && (
                  <TableRow>
                    <DataCell colSpan={visibleColumns.length} style={{ padding: 18, color: '#888' }}>
                      No results.
                    </DataCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableWrap>
        </ContentRow>
      </Box>
    </Root>
  );
};

export default AssetsRowTablePanel;
