/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    AssetsRowTablePanel.tsx

  Module Description:
    "Assets Row" mock page with:
      - Group sidebar (tree) + table scroll sync (group mode)
      - List mode (flat list, NO group header rows inside table)
      - ✅ Single table header row (NO top "MDL / RIG / ..." header)
      - Column group box borders
      - Gap between thumbnail and name
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
// Layout constants (must match between sidebar + table)
// ---------------------------------------------------------------------------
const GROUP_ROW_H = 32;
const ASSET_ROW_H = 44;
const LEFT_W = 260;

const HEADER_BG = '#2d2d2d';
const PANEL_BG = '#1e1e1e';
const BOX_BORDER = '2px solid rgba(255,255,255,0.28)';
const BOX_BORDER_SOFT = '1px solid rgba(255,255,255,0.16)';

// ---------------------------------------------------------------------------
// Column definitions (as const -> type safe)
// ---------------------------------------------------------------------------
const HEADER_COLUMNS = [
  { id: 'thumbnail', label: 'Thumbnail', minWidth: 110 },
  { id: 'name', label: 'Name', minWidth: 190 },

  { id: 'mdl_work', label: 'MDL Work', minWidth: 90 },
  { id: 'mdl_appr', label: 'MDL Appr', minWidth: 90 },
  { id: 'mdl_submitted', label: 'MDL Submitted At', minWidth: 140 },

  { id: 'rig_work', label: 'RIG Work', minWidth: 90 },
  { id: 'rig_appr', label: 'RIG Appr', minWidth: 90 },
  { id: 'rig_submitted', label: 'RIG Submitted At', minWidth: 140 },

  { id: 'bld_work', label: 'BLD Work', minWidth: 90 },
  { id: 'bld_appr', label: 'BLD Appr', minWidth: 90 },
  { id: 'bld_submitted', label: 'BLD Submitted At', minWidth: 140 },

  { id: 'dsn_work', label: 'DSN Work', minWidth: 90 },
  { id: 'dsn_appr', label: 'DSN Appr', minWidth: 90 },
  { id: 'dsn_submitted', label: 'DSN Submitted At', minWidth: 140 },

  { id: 'ldv_work', label: 'LDV Work', minWidth: 90 },
  { id: 'ldv_appr', label: 'LDV Appr', minWidth: 90 },
  { id: 'ldv_submitted', label: 'LDV Submitted At', minWidth: 140 },

  { id: 'relation', label: 'Relation', minWidth: 90 },
] as const;

type HeaderCol = (typeof HEADER_COLUMNS)[number];
type ColumnId = HeaderCol['id'];

type AssetRow = {
  id: string;
  name: string;
  thumbnail: string;
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

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const generateMockData = (id: string, name: string): AssetRow => ({
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

type Group = {
  id: string;
  label: string;
  count: number;
  assets: AssetRow[];
};

// ✅ Change group category names here (this is what you asked)
const GROUP_LABEL_MAP: Record<string, string> = {
  camera: 'CAMERA',
  character: 'CHARACTER',
  fx: 'FX',
  other: 'OTHER',
};

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
// Workflow column groups (for box borders)
// ---------------------------------------------------------------------------
const WORKFLOW_GROUPS = [
  { key: 'mdl', cols: ['mdl_work', 'mdl_appr', 'mdl_submitted'] as const },
  { key: 'rig', cols: ['rig_work', 'rig_appr', 'rig_submitted'] as const },
  { key: 'bld', cols: ['bld_work', 'bld_appr', 'bld_submitted'] as const },
  { key: 'dsn', cols: ['dsn_work', 'dsn_appr', 'dsn_submitted'] as const },
  { key: 'ldv', cols: ['ldv_work', 'ldv_appr', 'ldv_submitted'] as const },
] as const;

type WorkflowColId = (typeof WORKFLOW_GROUPS)[number]['cols'][number];

const ALL_GROUP_COLS: ReadonlySet<WorkflowColId> = new Set(
  WORKFLOW_GROUPS.flatMap((g) => [...g.cols])
);
const GROUP_START: ReadonlySet<WorkflowColId> = new Set(WORKFLOW_GROUPS.map((g) => g.cols[0]));
const GROUP_END: ReadonlySet<WorkflowColId> = new Set(
  WORKFLOW_GROUPS.map((g) => g.cols[g.cols.length - 1])
);

function boxBorderForCol(colId: ColumnId): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (!ALL_GROUP_COLS.has(colId as WorkflowColId)) return style;

  // vertical borders for the "box" look
  if (GROUP_START.has(colId as WorkflowColId)) style.borderLeft = BOX_BORDER;
  if (GROUP_END.has(colId as WorkflowColId)) style.borderRight = BOX_BORDER;

  return style;
}

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const Root = styled(Container)(({ theme }) => ({
  position: 'relative',
  padding: 0,
  backgroundColor: PANEL_BG,
  minHeight: '100vh',
  '& > *': { padding: theme.spacing(1) },
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
  flexDirection: 'row',
  width: '100%',
  alignItems: 'stretch',
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
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingLeft: 12,
  paddingRight: 8,
  backgroundColor: HEADER_BG,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
});

const LeftPanelBody = styled('div')({
  overflowY: 'auto',
  flex: 1,
});

const TableShell = styled(Paper)({
  flex: 1,
  overflow: 'hidden',
  backgroundColor: PANEL_BG,
  borderRadius: 0,
  boxShadow: 'none',
});

const TableScroller = styled('div')({
  height: 'calc(100vh - 110px)',
  overflow: 'auto',
});

const HeaderCell = styled(TableCell)({
  fontWeight: 700,
  textTransform: 'uppercase',
  fontSize: 11,
  letterSpacing: 0.5,
  whiteSpace: 'nowrap',
  padding: '8px 10px',
  backgroundColor: `${HEADER_BG} !important`,
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
});

const GroupTitleCell = styled(TableCell)({
  padding: '10px 12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  fontSize: 12,
  color: '#00b7ff',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
});

const Thumb = styled('div')({
  width: 28,
  height: 20,
  borderRadius: 2,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.18)',
  flex: '0 0 auto',
});

const RowItem = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: 10, // ✅ gap between thumb and name
});

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

    if (from === 'left') tableEl.scrollTop = leftEl.scrollTop;
    else leftEl.scrollTop = tableEl.scrollTop;

    requestAnimationFrame(() => {
      syncingRef.current = null;
    });
  }, []);

  const toggleGroup = (id: string) => setOpenGroups((p) => ({ ...p, [id]: !p[id] }));

  // columns based on mode
  const headerColumns = React.useMemo(() => {
    if (barView === 'group') return HEADER_COLUMNS.filter((c) => c.id !== 'thumbnail' && c.id !== 'name');
    return HEADER_COLUMNS;
  }, [barView]);

  // search filter
  const groupsFiltered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MOCK_GROUPS;

    return MOCK_GROUPS.map((g) => {
      const assets = g.assets.filter((a) => a.name.toLowerCase().includes(q));
      return { ...g, assets, count: assets.length };
    }).filter((g) => g.assets.length > 0);
  }, [search]);

  // list mode rows => flat, NO group header rows in table
  const listRows = React.useMemo(() => groupsFiltered.flatMap((g) => g.assets), [groupsFiltered]);

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
                        <ListItem button onClick={() => toggleGroup(g.id)} style={{ height: GROUP_ROW_H }}>
                          <ListItemText
                            primary={`${g.label} (${g.count})`}
                            primaryTypographyProps={{
                              style: { fontSize: 12, color: '#fff', fontWeight: 700 },
                            }}
                          />
                          {isOpen ? <ExpandLessIcon style={{ color: '#666' }} /> : <ExpandMoreIcon style={{ color: '#666' }} />}
                        </ListItem>

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
                  {/* ✅ SINGLE HEADER ROW ONLY (no MDL/RIG top row) */}
                  <TableRow>
                    {headerColumns.map((c) => {
                      const extra = boxBorderForCol(c.id);

                      // ✅ gap between thumbnail and name (list mode)
                      const isThumb = c.id === 'thumbnail';
                      const isName = c.id === 'name';

                      return (
                        <HeaderCell
                          key={c.id}
                          style={{
                            minWidth: c.minWidth,
                            ...extra,
                            ...(ALL_GROUP_COLS.has(c.id as any) ? { borderTop: BOX_BORDER, borderBottom: BOX_BORDER_SOFT } : null),
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
                  {/* LIST MODE: flat rows (NO group title rows) */}
                  {barView === 'list' &&
                    listRows.map((asset) => (
                      <TableRow key={asset.id} hover>
                        {headerColumns.map((c) => {
                          const extra = boxBorderForCol(c.id);
                          const val = asset[c.id];

                          if (c.id === 'thumbnail') {
                            return (
                              <DataCell key={c.id} style={{ ...extra, paddingRight: 18 }}>
                                <Thumb />
                              </DataCell>
                            );
                          }

                          if (c.id === 'name') {
                            return (
                              <DataCell key={c.id} style={{ ...extra, paddingLeft: 18 }}>
                                {asset.name}
                              </DataCell>
                            );
                          }

                          return (
                            <DataCell key={c.id} style={extra}>
                              {val === '—' ? <span style={{ opacity: 0.25 }}>—</span> : val}
                            </DataCell>
                          );
                        })}
                      </TableRow>
                    ))}

                  {/* GROUP MODE: group title row + rows (sidebar controls collapse) */}
                  {barView === 'group' &&
                    groupsFiltered.map((group) => {
                      const isOpen = !!openGroups[group.id];
                      const groupTitle = GROUP_LABEL_MAP[group.id] ?? group.label.toUpperCase();

                      return (
                        <React.Fragment key={group.id}>
                          {/* group title row in table */}
                          <TableRow>
                            <GroupTitleCell colSpan={headerColumns.length}>{groupTitle}</GroupTitleCell>
                          </TableRow>

                          {isOpen &&
                            group.assets.map((asset) => (
                              <TableRow key={asset.id} hover>
                                {headerColumns.map((c) => {
                                  const extra = boxBorderForCol(c.id);
                                  const val = asset[c.id];

                                  return (
                                    <DataCell key={c.id} style={extra}>
                                      {val === '—' ? <span style={{ opacity: 0.25 }}>—</span> : val}
                                    </DataCell>
                                  );
                                })}
                              </TableRow>
                            ))}

                          {/* keep scroll height aligned when collapsed */}
                          {!isOpen && <TableRow style={{ height: 0 }} />}
                        </React.Fragment>
                      );
                    })}
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
