/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    AssetsRowTablePanel.tsx

  Module Description:
    "Assets Row" page with:
      - Group sidebar (tree) + table scroll sync (group mode)
      - List mode (flat list, no group header rows)
      - 2-level table header with workflow group boxes (MDL/RIG/BLD/DSN/LDV)
      - Column group borders (box look)
      - Better thumbnail/name spacing
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

// ---------------------------------------------------------------------------
// Layout constants (MUST match between sidebar + table)
// ---------------------------------------------------------------------------
const GROUP_ROW_H = 32;
const ASSET_ROW_H = 44;
const LEFT_W = 260;

const BOX_BORDER = '2px solid rgba(255,255,255,0.25)';
const BOX_BORDER_SOFT = '1px solid rgba(255,255,255,0.18)';
const HEADER_BG = '#2d2d2d';
const PANEL_BG = '#1e1e1e';

// ---------------------------------------------------------------------------
// Styled Components
// ---------------------------------------------------------------------------

const Root = styled(Container)(({ theme }) => ({
  position: 'relative',
  padding: 0,
  backgroundColor: PANEL_BG,
  minHeight: '100vh',
  '& > *': {
    padding: theme.spacing(1),
  },
}));

const Toolbar = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: HEADER_BG,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  padding: theme.spacing(1),
  height: 48,
  boxSizing: 'border-box',
}));

const ContentRow = styled('div')({
  display: 'flex',
  width: '100%',
  alignItems: 'stretch',
  overflow: 'hidden',
});

const LeftPanel = styled('div')({
  width: LEFT_W,
  minWidth: LEFT_W,
  backgroundColor: '#252525',
  borderRight: '1px solid rgba(255,255,255,0.12)',
  display: 'flex',
  flexDirection: 'column',
});

const LeftPanelHeader = styled('div')({
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingLeft: 12,
  paddingRight: 8,
  backgroundColor: HEADER_BG,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  boxSizing: 'border-box',
});

const LeftPanelBody = styled('div')({
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
});

const TableShell = styled(Paper)({
  flex: 1,
  backgroundColor: PANEL_BG,
  borderRadius: 0,
  boxShadow: 'none',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
});

const TableScroller = styled('div')({
  flex: 1,
  overflow: 'auto',
  minWidth: 0,
});

const HeaderCell = styled(TableCell)({
  fontWeight: 600,
  textTransform: 'uppercase',
  fontSize: 11,
  letterSpacing: 0.5,
  whiteSpace: 'nowrap',
  padding: '8px 10px',
  backgroundColor: `${HEADER_BG} !important`,
  color: '#ffffff',
  borderBottom: '1px solid rgba(255,255,255,0.12)',
});

const GroupHeaderCell = styled(TableCell)({
  fontWeight: 700,
  textTransform: 'uppercase',
  fontSize: 11,
  letterSpacing: 0.7,
  whiteSpace: 'nowrap',
  padding: '6px 10px',
  backgroundColor: `${HEADER_BG} !important`,
  color: '#fff',
  textAlign: 'center',
  borderBottom: '1px solid rgba(255,255,255,0.12)',
});

const DataCell = styled(TableCell)({
  color: '#b0b0b0',
  fontSize: 12,
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  padding: '0 10px',
  height: ASSET_ROW_H,
  lineHeight: `${ASSET_ROW_H}px`,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  verticalAlign: 'middle',
});

const GroupRowCell = styled(TableCell)({
  padding: '0 10px',
  height: GROUP_ROW_H,
  lineHeight: `${GROUP_ROW_H}px`,
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  color: '#00b7ff',
  backgroundColor: PANEL_BG,
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  boxSizing: 'border-box',
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
  gap: 18,
  height: 28,
});

// ---------------------------------------------------------------------------
// Types & Mock Data
// ---------------------------------------------------------------------------

type HeaderCol = { id: string; label: string; minWidth?: number };

const HEADER_COLUMNS: HeaderCol[] = [
  { id: 'thumbnail', label: 'Thumbnail', minWidth: 110 },
  { id: 'name', label: 'Name', minWidth: 170 },

  { id: 'mdl_work', label: 'MDL Work', minWidth: 90 },
  { id: 'mdl_appr', label: 'MDL Appr', minWidth: 90 },
  { id: 'mdl_submitted', label: 'MDL Submitted At', minWidth: 130 },

  { id: 'rig_work', label: 'RIG Work', minWidth: 90 },
  { id: 'rig_appr', label: 'RIG Appr', minWidth: 90 },
  { id: 'rig_submitted', label: 'RIG Submitted At', minWidth: 130 },

  { id: 'bld_work', label: 'BLD Work', minWidth: 90 },
  { id: 'bld_appr', label: 'BLD Appr', minWidth: 90 },
  { id: 'bld_submitted', label: 'BLD Submitted At', minWidth: 130 },

  { id: 'dsn_work', label: 'DSN Work', minWidth: 90 },
  { id: 'dsn_appr', label: 'DSN Appr', minWidth: 90 },
  { id: 'dsn_submitted', label: 'DSN Submitted At', minWidth: 130 },

  { id: 'ldv_work', label: 'LDV Work', minWidth: 90 },
  { id: 'ldv_appr', label: 'LDV Appr', minWidth: 90 },
  { id: 'ldv_submitted', label: 'LDV Submitted At', minWidth: 130 },

  { id: 'relation', label: 'Relation', minWidth: 90 },
];

const generateMockData = (id: string, name: string) => ({
  id,
  name,
  thumbnail: '—',
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

// ---------------------------------------------------------------------------
// Column grouping (box borders)
// ---------------------------------------------------------------------------

const WORKFLOW_GROUPS = [
  { key: 'mdl', label: 'MDL', cols: ['mdl_work', 'mdl_appr', 'mdl_submitted'] },
  { key: 'rig', label: 'RIG', cols: ['rig_work', 'rig_appr', 'rig_submitted'] },
  { key: 'bld', label: 'BLD', cols: ['bld_work', 'bld_appr', 'bld_submitted'] },
  { key: 'dsn', label: 'DSN', cols: ['dsn_work', 'dsn_appr', 'dsn_submitted'] },
  { key: 'ldv', label: 'LDV', cols: ['ldv_work', 'ldv_appr', 'ldv_submitted'] },
] as const;

const GROUP_START = new Set(WORKFLOW_GROUPS.map((g) => g.cols[0]));
const GROUP_END = new Set(WORKFLOW_GROUPS.map((g) => g.cols[g.cols.length - 1]));
const ALL_GROUP_COLS = new Set(WORKFLOW_GROUPS.flatMap((g) => g.cols));

function borderForCol(colId: string) {
  const style: React.CSSProperties = {};
  if (!ALL_GROUP_COLS.has(colId)) return style;

  if (GROUP_START.has(colId)) style.borderLeft = BOX_BORDER;
  if (GROUP_END.has(colId)) style.borderRight = BOX_BORDER;
  return style;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

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

  // ---- scroll sync refs
  const leftScrollRef = React.useRef<HTMLDivElement | null>(null);
  const tableScrollRef = React.useRef<HTMLDivElement | null>(null);
  const syncingRef = React.useRef<'left' | 'table' | null>(null);

  const syncScroll = React.useCallback((from: 'left' | 'table') => {
    if (syncingRef.current && syncingRef.current !== from) return;

    syncingRef.current = from;

    const leftEl = leftScrollRef.current;
    const tableEl = tableScrollRef.current;
    if (!leftEl || !tableEl) return;

    if (from === 'left') {
      tableEl.scrollTop = leftEl.scrollTop;
    } else {
      leftEl.scrollTop = tableEl.scrollTop;
    }

    requestAnimationFrame(() => {
      syncingRef.current = null;
    });
  }, []);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter columns based on view mode
  const headerColumns = React.useMemo(() => {
    if (barView === 'group') {
      // group mode: hide thumbnail+name (because those are in sidebar)
      return HEADER_COLUMNS.filter((c) => c.id !== 'thumbnail' && c.id !== 'name');
    }
    // list mode: show all
    return HEADER_COLUMNS;
  }, [barView]);

  // mock search filter
  const groupsFiltered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MOCK_GROUPS;

    return MOCK_GROUPS.map((g) => {
      const assets = g.assets.filter((a) => a.name.toLowerCase().includes(q));
      return { ...g, assets, count: assets.length };
    }).filter((g) => g.assets.length > 0);
  }, [search]);

  const listRows = React.useMemo(() => {
    // list mode is a flat array => NO GROUP HEADER ROWS
    return groupsFiltered.flatMap((g) => g.assets.map((a) => ({ ...a, __group: g.id })));
  }, [groupsFiltered]);

  const renderTopGroupHeader = barView === 'list';

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

              <LeftPanelBody ref={leftScrollRef} onScroll={() => syncScroll('left')}>
                <List dense disablePadding>
                  {groupsFiltered.map((g) => {
                    const isOpen = !!openGroups[g.id];
                    return (
                      <React.Fragment key={g.id}>
                        {/* Group header (height fixed) */}
                        <ListItem button onClick={() => toggleGroup(g.id)} style={{ height: GROUP_ROW_H }}>
                          <ListItemText
                            primary={`${g.label} (${g.count})`}
                            primaryTypographyProps={{
                              style: { fontSize: 12, color: '#fff', fontWeight: 600 },
                            }}
                          />
                          {isOpen ? (
                            <ExpandLessIcon style={{ color: '#666' }} />
                          ) : (
                            <ExpandMoreIcon style={{ color: '#666' }} />
                          )}
                        </ListItem>

                        {/* Asset rows (height fixed to match table) */}
                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                          {g.assets.map((a) => (
                            <ListItem key={a.id} button style={{ paddingLeft: 24, height: ASSET_ROW_H }}>
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

          {/* RIGHT PANEL */}
          <TableShell>
            <TableScroller ref={tableScrollRef} onScroll={() => syncScroll('table')}>
              <Table stickyHeader size="small">
                <TableHead>
                  {/* TOP GROUP BOX HEADER (MDL/RIG/BLD/DSN/LDV) */}
                  <TableRow>
                    {renderTopGroupHeader && (
                      <>
                        <GroupHeaderCell style={{ minWidth: 110 }} />
                        <GroupHeaderCell style={{ minWidth: 170 }} />
                      </>
                    )}

                    {WORKFLOW_GROUPS.map((g) => (
                      <GroupHeaderCell
                        key={g.key}
                        colSpan={g.cols.length}
                        style={{
                          borderLeft: BOX_BORDER,
                          borderRight: BOX_BORDER,
                          borderTop: BOX_BORDER,
                          borderBottom: BOX_BORDER_SOFT,
                        }}
                      >
                        {g.label}
                      </GroupHeaderCell>
                    ))}

                    <GroupHeaderCell style={{ borderTop: BOX_BORDER, borderBottom: BOX_BORDER_SOFT }}>
                      Relation
                    </GroupHeaderCell>
                  </TableRow>

                  {/* SECOND HEADER ROW (actual columns) */}
                  <TableRow>
                    {headerColumns.map((c) => {
                      const extra = borderForCol(c.id);
                      const isThumb = c.id === 'thumbnail';
                      const isName = c.id === 'name';

                      return (
                        <HeaderCell
                          key={c.id}
                          style={{
                            minWidth: c.minWidth,
                            ...(extra || {}),
                            ...(isThumb ? { paddingRight: 18 } : null),
                            ...(isName ? { paddingLeft: 18 } : null),
                          }}
                        >
                          {c.label}
                        </HeaderCell>
                      );
                    })}
                  </TableRow>
                </TableHead>

                <TableBody>
                  {/* GROUP MODE */}
                  {barView === 'group' &&
                    groupsFiltered.map((group) => {
                      const isOpen = !!openGroups[group.id];

                      return (
                        <React.Fragment key={group.id}>
                          <TableRow>
                            <GroupRowCell colSpan={headerColumns.length}>{group.label}</GroupRowCell>
                          </TableRow>

                          {isOpen &&
                            group.assets.map((asset) => (
                              <TableRow key={asset.id} hover style={{ height: ASSET_ROW_H }}>
                                {headerColumns.map((col) => {
                                  const val = (asset as any)[col.id];
                                  const extra = borderForCol(col.id);

                                  const isThumb = col.id === 'thumbnail';
                                  const isName = col.id === 'name';

                                  return (
                                    <DataCell
                                      key={col.id}
                                      style={{
                                        ...(extra || {}),
                                        ...(isThumb ? { paddingRight: 18 } : null),
                                        ...(isName ? { paddingLeft: 18 } : null),
                                      }}
                                    >
                                      {val === '—' ? <span style={{ opacity: 0.3 }}>—</span> : val}
                                    </DataCell>
                                  );
                                })}
                              </TableRow>
                            ))}

                          {!isOpen && (
                            <TableRow style={{ height: 0 }}>
                              <TableCell style={{ padding: 0, border: 0 }} colSpan={headerColumns.length} />
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}

                  {/* LIST MODE (NO GROUP HEADER ROWS) */}
                  {barView === 'list' &&
                    listRows.map((asset) => (
                      <TableRow key={asset.id} hover style={{ height: ASSET_ROW_H }}>
                        {headerColumns.map((col) => {
                          const val = (asset as any)[col.id];
                          const extra = borderForCol(col.id);

                          const isThumb = col.id === 'thumbnail';
                          const isName = col.id === 'name';

                          return (
                            <DataCell
                              key={col.id}
                              style={{
                                ...(extra || {}),
                                ...(isThumb ? { paddingRight: 18 } : null),
                                ...(isName ? { paddingLeft: 18 } : null),
                              }}
                            >
                              {val === '—' ? <span style={{ opacity: 0.3 }}>—</span> : val}
                            </DataCell>
                          );
                        })}
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableScroller>
          </TableShell>
        </ContentRow>
      </Box>
    </Root>
  );
};

export default AssetsRowTablePanel;
