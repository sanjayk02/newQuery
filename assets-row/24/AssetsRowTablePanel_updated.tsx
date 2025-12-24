/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    AssetsRowTablePanel.tsx

  Module Description:
    Assets Row Table with:
      - Group (sidebar) mode: left "Groups" panel renders a THUMBE/NAME grid aligned with table rows
      - List mode: full table (includes Thumbnail + Name columns) with group section rows
      - Single header row (NO top MDL/RIG/BLD grouped header row)
      - Column "box" borders for workflow groups (MDL/RIG/BLD/DSN/LDV)
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
// Theme-ish constants
// ---------------------------------------------------------------------------

const BG = '#1e1e1e';
const PANEL_BG = '#1f1f1f';
const HEADER_BG = '#2d2d2d';
const SIDE_BG = '#252525';
const BORDER_STRONG = 'rgba(255,255,255,0.18)';
const BORDER_SOFT = 'rgba(255,255,255,0.08)';
const TEXT = '#ffffff';
const TEXT_DIM = '#b0b0b0';
const ACCENT = '#00b7ff';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WorkflowCol =
  | 'mdl_work' | 'mdl_appr' | 'mdl_submitted'
  | 'rig_work' | 'rig_appr' | 'rig_submitted'
  | 'bld_work' | 'bld_appr' | 'bld_submitted'
  | 'dsn_work' | 'dsn_appr' | 'dsn_submitted'
  | 'ldv_work' | 'ldv_appr' | 'ldv_submitted';

type ColumnId = 'thumbnail' | 'name' | WorkflowCol | 'relation';

type Column = { id: ColumnId; label: string; minWidth: number };

type AssetRow = {
  id: string;
  name: string;
  thumbnail?: string;
  relation: string;
} & Record<WorkflowCol, string>;

type GroupRow = {
  id: string;
  label: string;
  count: number;
  assets: AssetRow[];
};

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const HEADER_COLUMNS: Column[] = [
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

const WORKFLOW_GROUPS = [
  { key: 'mdl', cols: ['mdl_work', 'mdl_appr', 'mdl_submitted'] as const },
  { key: 'rig', cols: ['rig_work', 'rig_appr', 'rig_submitted'] as const },
  { key: 'bld', cols: ['bld_work', 'bld_appr', 'bld_submitted'] as const },
  { key: 'dsn', cols: ['dsn_work', 'dsn_appr', 'dsn_submitted'] as const },
  { key: 'ldv', cols: ['ldv_work', 'ldv_appr', 'ldv_submitted'] as const },
] as const;

const WORKFLOW_COLS = new Set<WorkflowCol>(WORKFLOW_GROUPS.flatMap((g) => [...g.cols]) as WorkflowCol[]);

const FIRST_COL_IN_GROUP: Partial<Record<WorkflowCol, true>> = {};
const LAST_COL_IN_GROUP: Partial<Record<WorkflowCol, true>> = {};
WORKFLOW_GROUPS.forEach((g) => {
  FIRST_COL_IN_GROUP[g.cols[0]] = true;
  LAST_COL_IN_GROUP[g.cols[g.cols.length - 1]] = true;
});

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const generateMockData = (id: string, name: string): AssetRow => ({
  id,
  name,
  thumbnail: '',
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

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Root = styled(Container)(({ theme }) => ({
  position: 'relative',
  padding: 0,
  backgroundColor: BG,
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
  borderBottom: `1px solid ${BORDER_SOFT}`,
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
  backgroundColor: SIDE_BG,
  borderRight: `1px solid ${BORDER_STRONG}`,
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
  borderBottom: `1px solid ${BORDER_SOFT}`,
});

const LeftPanelBody = styled('div')({
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
});

const SideTableHeaderRow = styled('div')({
  display: 'grid',
  gridTemplateColumns: '76px 1fr',
  alignItems: 'center',
  height: 36,
  backgroundColor: HEADER_BG,
  borderBottom: `1px solid ${BORDER_STRONG}`,
});

const SideHeaderCell = styled('div')({
  padding: '8px 10px',
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  color: TEXT,
  whiteSpace: 'nowrap',
});

const SideHeaderThumb = styled(SideHeaderCell)({
  borderRight: `1px solid ${BORDER_STRONG}`,
});

const SideHeaderName = styled(SideHeaderCell)({
  paddingLeft: 18, // visual gap like screenshot
});

const SideGroupRow = styled(ListItem)({
  height: 32,
  paddingLeft: 10,
  paddingRight: 8,
  borderBottom: `1px solid rgba(255,255,255,0.05)`,
});

const SideAssetRow = styled(ListItem)({
  height: 44, // MUST match table row cell height
  paddingLeft: 10,
  paddingRight: 8,
  borderBottom: `1px solid rgba(255,255,255,0.05)`,
});

const SideAssetGrid = styled('div')({
  display: 'grid',
  gridTemplateColumns: '76px 1fr',
  alignItems: 'center',
  width: '100%',
});

const SideThumbCell = styled('div')({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 10, // gap between thumb and name requested (inside thumb cell, we keep spacing too)
  paddingLeft: 6,
  paddingRight: 10,
  borderRight: `1px solid ${BORDER_STRONG}`,
  height: '100%',
  boxSizing: 'border-box',
});

const SideNameCell = styled('div')({
  paddingLeft: 18, // gap between thumb and name (like screenshot)
  color: '#ddd',
  fontSize: 12,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const Thumb = styled('div')({
  width: 22,
  height: 22,
  borderRadius: 2,
  background: 'rgba(255,255,255,0.06)',
  border: `1px solid rgba(255,255,255,0.18)`,
  flex: '0 0 auto',
});

const TableWrap = styled(Paper)({
  flex: 1,
  overflowX: 'auto',
  backgroundColor: PANEL_BG,
  borderRadius: 0,
  boxShadow: 'none',
});

const HeaderCell = styled(TableCell)({
  fontWeight: 700,
  textTransform: 'uppercase',
  fontSize: 11,
  letterSpacing: 0.5,
  whiteSpace: 'nowrap',
  padding: '8px 10px',
  backgroundColor: `${HEADER_BG} !important`,
  color: TEXT,
  borderBottom: `1px solid ${BORDER_STRONG}`,
  borderRight: `1px solid ${BORDER_STRONG}`,
});

const DataCell = styled(TableCell)({
  color: TEXT_DIM,
  padding: '8px 10px',
  fontSize: 12,
  borderBottom: `1px solid rgba(255,255,255,0.05)`,
  height: 44,
  boxSizing: 'border-box',
  borderRight: `1px solid rgba(255,255,255,0.10)`,
});

// Group section row in list view
const GroupSectionCell = styled(TableCell)({
  padding: '10px 10px',
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: ACCENT,
  backgroundColor: '#202020',
  borderBottom: `1px solid rgba(255,255,255,0.08)`,
});

// ---------------------------------------------------------------------------
// Component
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

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const headerColumns = React.useMemo(() => {
    // In group mode: left panel already shows thumb+name, so hide those columns in table
    if (barView === 'group') return HEADER_COLUMNS.filter((c) => c.id !== 'thumbnail' && c.id !== 'name');
    return HEADER_COLUMNS;
  }, [barView]);

  // Very simple search across asset name (mock)
  const filteredGroups = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MOCK_GROUPS;

    return MOCK_GROUPS.map((g) => ({
      ...g,
      assets: g.assets.filter((a) => a.name.toLowerCase().includes(q)),
      count: g.assets.filter((a) => a.name.toLowerCase().includes(q)).length,
    })).filter((g) => g.assets.length > 0);
  }, [search]);

  const getCellBorders = (colId: ColumnId): React.CSSProperties => {
    // "Box" borders only for workflow columns
    if (!WORKFLOW_COLS.has(colId as WorkflowCol)) return {};
    const wf = colId as WorkflowCol;

    return {
      borderLeft: FIRST_COL_IN_GROUP[wf] ? `2px solid ${BORDER_STRONG}` : undefined,
      borderRight: LAST_COL_IN_GROUP[wf] ? `2px solid ${BORDER_STRONG}` : undefined,
    };
  };

  return (
    <Root maxWidth={false}>
      <Box>
        <Toolbar>
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <IconButton onClick={() => setBarView('list')} style={{ padding: 6 }}>
              <ViewListIcon style={{ fontSize: 18, color: barView === 'list' ? ACCENT : TEXT_DIM }} />
            </IconButton>
            <IconButton onClick={() => setBarView('group')} style={{ padding: 6 }}>
              <ViewModuleIcon style={{ fontSize: 18, color: barView === 'group' ? ACCENT : TEXT_DIM }} />
            </IconButton>
            {barView === 'group' && (
              <IconButton onClick={() => setLeftOpen((v) => !v)} style={{ padding: 6 }}>
                <MenuIcon style={{ fontSize: 18, color: TEXT }} />
              </IconButton>
            )}
            <Typography variant="subtitle2" style={{ color: TEXT, marginLeft: 8 }}>
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
              InputProps={{
                style: { height: 30, color: TEXT, fontSize: 12, backgroundColor: '#444' },
              }}
              style={{ width: 200 }}
            />
            <IconButton style={{ padding: 6 }}>
              <FilterListIcon style={{ fontSize: 18, color: TEXT_DIM }} />
            </IconButton>
          </Box>
        </Toolbar>

        <ContentRow>
          {/* LEFT PANEL: Group Category (ONLY in group mode) */}
          {barView === 'group' && leftOpen && (
            <LeftPanel>
              <LeftPanelHeader>
                <Typography variant="caption" style={{ color: TEXT, fontWeight: 700 }}>
                  Groups
                </Typography>
                <Typography variant="caption" style={{ color: '#666' }}>
                  (mock)
                </Typography>
              </LeftPanelHeader>

              {/* Table-like header: THUMBE | NAME */}
              <SideTableHeaderRow>
                <SideHeaderThumb>THUMBE</SideHeaderThumb>
                <SideHeaderName>NAME</SideHeaderName>
              </SideTableHeaderRow>

              <LeftPanelBody>
                <List dense disablePadding>
                  {filteredGroups.map((g) => {
                    const isOpen = !!openGroups[g.id];
                    return (
                      <React.Fragment key={g.id}>
                        <SideGroupRow button onClick={() => toggleGroup(g.id)}>
                          <ListItemText
                            primary={`${g.label} (${g.count})`}
                            primaryTypographyProps={{ style: { fontSize: 12, color: TEXT, fontWeight: 700 } }}
                          />
                          {isOpen ? <ExpandLessIcon style={{ color: '#666' }} /> : <ExpandMoreIcon style={{ color: '#666' }} />}
                        </SideGroupRow>

                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                          {g.assets.map((a) => (
                            <SideAssetRow key={a.id} button>
                              <SideAssetGrid>
                                <SideThumbCell>
                                  <Thumb />
                                </SideThumbCell>
                                <SideNameCell>{a.name}</SideNameCell>
                              </SideAssetGrid>
                            </SideAssetRow>
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
                    <HeaderCell key={c.id} style={{ minWidth: c.minWidth, ...getCellBorders(c.id) }}>
                      {c.label}
                    </HeaderCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredGroups.map((group) => {
                  const isOpen = barView === 'list' || openGroups[group.id];

                  return (
                    <React.Fragment key={group.id}>
                      {/* List mode: keep group section rows (undo previous removal) */}
                      {barView === 'list' && (
                        <TableRow>
                          <GroupSectionCell colSpan={headerColumns.length}>
                            {group.label.toUpperCase()}
                          </GroupSectionCell>
                        </TableRow>
                      )}

                      {isOpen &&
                        group.assets.map((asset) => (
                          <TableRow key={asset.id} hover>
                            {headerColumns.map((col) => {
                              const colId = col.id;

                              // special render for list mode only
                              if (barView === 'list' && colId === 'thumbnail') {
                                return (
                                  <DataCell key={colId} style={{ width: 100 }}>
                                    <span style={{ opacity: 0.35 }}>—</span>
                                  </DataCell>
                                );
                              }

                              if (barView === 'list' && colId === 'name') {
                                return (
                                  <DataCell key={colId} style={{ fontWeight: 600, color: '#ddd' }}>
                                    {asset.name}
                                  </DataCell>
                                );
                              }

                              const val = asset[colId as keyof AssetRow];

                              return (
                                <DataCell key={colId} style={getCellBorders(colId)}>
                                  {val === '—' ? <span style={{ opacity: 0.3 }}>—</span> : (val as any)}
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
