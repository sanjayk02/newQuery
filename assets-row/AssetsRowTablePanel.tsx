/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    AssetsRowTablePanel.tsx

  Module Description:
    Assets Row Table (Group mode + List mode) with proper alignment.
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

// ─────────────────────────────────────────────────────────────────────────────
// Styled
// ─────────────────────────────────────────────────────────────────────────────

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
  overflow: 'auto', // IMPORTANT: scrolling container (no TableContainer)
  backgroundColor: '#1e1e1e',
  borderRadius: 0,
  boxShadow: 'none',
  minHeight: 0,
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
  height: 44,
  boxSizing: 'border-box',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
});

const Thumb = styled('div')({
  width: 32,
  height: 24,
  borderRadius: 2,
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.2)',
  flex: '0 0 auto',
});

const NameWrap = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
});

const NameText = styled(Typography)({
  color: '#ddd',
  fontSize: 12,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

// ─────────────────────────────────────────────────────────────────────────────
// Types & Data
// ─────────────────────────────────────────────────────────────────────────────

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

type Group = {
  id: string;
  label: string;
  count: number;
  assets: AssetRow[];
};

const HEADER_COLUMNS = [
  { id: 'thumbnail', label: 'Thumbnail', minWidth: 90 },
  { id: 'name', label: 'Name', minWidth: 170 },
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
] as const;

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

const MOCK_GROUPS: Group[] = [
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
  { id: 'fx', label: 'fx', count: 1, assets: [generateMockData('fx_smoke', 'fx_smoke')] },
  { id: 'other', label: 'other', count: 1, assets: [generateMockData('env_prop', 'env_prop')] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

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

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Columns:
  // - Group mode: hide thumbnail+name (like your screenshot)
  // - List mode: show all columns
  const headerColumns = React.useMemo(() => {
    if (barView === 'group') {
      return HEADER_COLUMNS.filter((c) => c.id !== 'thumbnail' && c.id !== 'name');
    }
    return HEADER_COLUMNS;
  }, [barView]);

  // List mode data = FLAT rows (NO group title rows)
  const flatRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = MOCK_GROUPS.flatMap((g) => g.assets.map((a) => ({ ...a, __groupId: g.id, __groupLabel: g.label })));
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [search]);

  // Group mode data = groups filtered by search (still grouped)
  const groupedRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MOCK_GROUPS;
    return MOCK_GROUPS.map((g) => ({
      ...g,
      assets: g.assets.filter((a) => a.name.toLowerCase().includes(q)),
    })).filter((g) => g.assets.length > 0);
  }, [search]);

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
              style={{ width: 220 }}
            />
            <IconButton style={{ padding: 6 }}>
              <FilterListIcon style={{ fontSize: 18, color: '#b0b0b0' }} />
            </IconButton>
          </Box>
        </Toolbar>

        <ContentRow>
          {/* LEFT PANEL (only in group mode) */}
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
                  {groupedRows.map((g) => {
                    const isOpen = !!openGroups[g.id];
                    return (
                      <React.Fragment key={g.id}>
                        <ListItem button onClick={() => toggleGroup(g.id)} style={{ height: 32 }}>
                          <ListItemText
                            primary={`${g.label} (${g.assets.length})`}
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
                            <ListItem key={a.id} button style={{ paddingLeft: 24, height: 44 }}>
                              <NameWrap>
                                <Thumb />
                                <NameText>{a.name}</NameText>
                              </NameWrap>
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

          {/* TABLE */}
          <TableWrap>
            <Table stickyHeader size="small" style={{ tableLayout: 'fixed', minWidth: 1400 }}>
              {/* colgroup to make first columns stable in LIST mode */}
              <colgroup>
                {headerColumns.map((c) => (
                  <col key={c.id} style={{ width: c.minWidth }} />
                ))}
              </colgroup>

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
                {/* LIST MODE: flat rows (NO group title rows) */}
                {barView === 'list' &&
                  flatRows.map((asset) => (
                    <TableRow key={asset.id} hover>
                      {headerColumns.map((col) => {
                        if (col.id === 'thumbnail') {
                          return (
                            <DataCell key={col.id}>
                              <Thumb />
                            </DataCell>
                          );
                        }

                        if (col.id === 'name') {
                          return (
                            <DataCell key={col.id}>
                              <NameWrap>
                                {/* keep spacing consistent even if you hide thumb later */}
                                <NameText>{asset.name}</NameText>
                              </NameWrap>
                            </DataCell>
                          );
                        }

                        const val = (asset as any)[col.id];
                        return (
                          <DataCell key={col.id}>
                            {val === '—' ? <span style={{ opacity: 0.3 }}>—</span> : val}
                          </DataCell>
                        );
                      })}
                    </TableRow>
                  ))}

                {/* GROUP MODE: only show rows for expanded groups */}
                {barView === 'group' &&
                  groupedRows.map((group) => {
                    const isOpen = !!openGroups[group.id];
                    if (!isOpen) return null;

                    return (
                      <React.Fragment key={group.id}>
                        {group.assets.map((asset) => (
                          <TableRow key={asset.id} hover>
                            {headerColumns.map((col) => {
                              const val = (asset as any)[col.id];
                              return (
                                <DataCell key={col.id}>
                                  {val === '—' ? <span style={{ opacity: 0.3 }}>—</span> : val}
                                </DataCell>
                              );
                            })}
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
