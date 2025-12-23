/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    AssetsRowTablePanel.tsx

  Module Description:
    "Assets Row" page with LEFT group tree + RIGHT table.
    ✅ Proper alignment:
      - Same row heights for Group + Asset rows
      - Group header row always rendered in table
      - Vertical scroll is synchronized between left panel and table
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
  TableContainer,
  styled,
} from '@material-ui/core';

import MenuIcon from '@material-ui/icons/Menu';
import ViewModuleIcon from '@material-ui/icons/ViewModule';
import ViewListIcon from '@material-ui/icons/ViewList';
import FilterListIcon from '@material-ui/icons/FilterList';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';

// ---------------------- Layout constants (alignment) ----------------------

const TOOLBAR_H = 48;
const GROUP_ROW_H = 32;  // group header row height (left + right)
const ASSET_ROW_H = 44;  // asset row height (left + right)
const LEFT_W = 260;

// ---------------------- Styled Components ----------------------

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
  height: TOOLBAR_H,
  boxSizing: 'border-box',
}));

const ContentRow = styled('div')({
  display: 'flex',
  flexDirection: 'row',
  width: '100%',
  alignItems: 'stretch',
  gap: 0,
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
  backgroundColor: '#2d2d2d',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  boxSizing: 'border-box',
});

// IMPORTANT: this will be the scrollable area (and will sync with table scroll)
const LeftScrollBody = styled('div')({
  overflowY: 'auto',
  flex: 1,
});

const RightWrap = styled(Paper)({
  flex: 1,
  backgroundColor: '#1e1e1e',
  borderRadius: 0,
  boxShadow: 'none',
  minWidth: 0,
});

const RightScroll = styled(TableContainer)({
  height: `calc(100vh - ${TOOLBAR_H}px - 16px)`, // 16px ~ root padding; tweak if needed
  overflow: 'auto',
  backgroundColor: '#1e1e1e',
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
});

const GroupRowCell = styled(TableCell)({
  color: '#ffffff',
  fontSize: 12,
  fontWeight: 700,
  height: GROUP_ROW_H,
  padding: '0 10px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  backgroundColor: '#202020',
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
  gap: 10,
  height: ASSET_ROW_H,
});

// ---------------------- Types & Data ----------------------

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
  thumbnail?: string;
};

type Group = {
  id: string;
  label: string;
  assets: AssetRow[];
};

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

const MOCK_GROUPS: Group[] = [
  {
    id: 'camera',
    label: 'camera',
    assets: [
      generateMockData('camAim', 'camAim'),
      generateMockData('camHero', 'camHero'),
      generateMockData('camWide', 'camWide'),
    ],
  },
  {
    id: 'character',
    label: 'character',
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
    assets: [generateMockData('fx_smoke', 'fx_smoke')],
  },
  {
    id: 'other',
    label: 'other',
    assets: [generateMockData('env_prop', 'env_prop')],
  },
];

// ---------------------- Main Component ----------------------

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

  // refs for scroll sync
  const leftScrollRef = React.useRef<HTMLDivElement | null>(null);
  const rightScrollRef = React.useRef<HTMLDivElement | null>(null);

  const syncingRef = React.useRef<'left' | 'right' | null>(null);

  const syncScroll = (from: 'left' | 'right') => {
    const left = leftScrollRef.current;
    const right = rightScrollRef.current;
    if (!left || !right) return;

    if (syncingRef.current && syncingRef.current !== from) return;

    syncingRef.current = from;

    if (from === 'left') {
      right.scrollTop = left.scrollTop;
    } else {
      left.scrollTop = right.scrollTop;
    }

    // release lock on next frame
    requestAnimationFrame(() => {
      syncingRef.current = null;
    });
  };

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // columns: in "group" mode we hide thumbnail/name (as per your current logic)
  const headerColumns = React.useMemo(() => {
    if (barView !== 'group') return HEADER_COLUMNS;
    return HEADER_COLUMNS.filter((c) => c.id !== 'thumbnail' && c.id !== 'name');
  }, [barView]);

  // apply search filter (keeps alignment correct because table + left both use filtered data)
  const filteredGroups: Group[] = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MOCK_GROUPS;

    return MOCK_GROUPS
      .map((g) => ({
        ...g,
        assets: g.assets.filter((a) => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)),
      }))
      .filter((g) => g.assets.length > 0);
  }, [search]);

  return (
    <Root maxWidth={false}>
      <Box>
        {/* TOP TOOLBAR */}
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
              InputProps={{
                style: { height: 30, color: '#fff', fontSize: 12, backgroundColor: '#444' },
              }}
              style={{ width: 220 }}
            />
            <IconButton style={{ padding: 6 }}>
              <FilterListIcon style={{ fontSize: 18, color: '#b0b0b0' }} />
            </IconButton>
          </Box>
        </Toolbar>

        <ContentRow>
          {/* LEFT PANEL */}
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

              <LeftScrollBody
                ref={leftScrollRef}
                onScroll={() => syncScroll('left')}
              >
                <List dense disablePadding>
                  {filteredGroups.map((g) => {
                    const isOpen = !!openGroups[g.id];
                    const count = g.assets.length;

                    return (
                      <React.Fragment key={g.id}>
                        <ListItem
                          button
                          onClick={() => toggleGroup(g.id)}
                          style={{ height: GROUP_ROW_H }}
                        >
                          <ListItemText
                            primary={`${g.label} (${count})`}
                            primaryTypographyProps={{
                              style: { fontSize: 12, color: '#fff', fontWeight: 700 },
                            }}
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
                              style={{ paddingLeft: 24, height: ASSET_ROW_H }}
                            >
                              <RowItem>
                                <Thumb />
                                <Typography style={{ color: '#ddd', fontSize: 12 }}>
                                  {a.name}
                                </Typography>
                              </RowItem>
                            </ListItem>
                          ))}
                        </Collapse>
                      </React.Fragment>
                    );
                  })}
                </List>
              </LeftScrollBody>
            </LeftPanel>
          )}

          {/* RIGHT TABLE */}
          <RightWrap>
            <RightScroll
              // @ts-ignore - MUI TableContainer forwards ref to div
              ref={rightScrollRef}
              onScroll={() => syncScroll('right')}
            >
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
                  {filteredGroups.map((group) => {
                    const isOpen = barView === 'list' || openGroups[group.id];

                    return (
                      <React.Fragment key={group.id}>
                        {/* ✅ Always show group header row in table (keeps alignment with LEFT group row) */}
                        <TableRow style={{ height: GROUP_ROW_H }}>
                          <GroupRowCell colSpan={headerColumns.length}>
                            {group.label.toUpperCase()}
                          </GroupRowCell>
                        </TableRow>

                        {/* Asset rows */}
                        {isOpen &&
                          group.assets.map((asset) => (
                            <TableRow key={asset.id} hover style={{ height: ASSET_ROW_H }}>
                              {headerColumns.map((col) => {
                                const val = (asset as any)[col.id];

                                // if you ever show thumbnail/name in list mode, you can render custom here
                                if (col.id === 'thumbnail') {
                                  return (
                                    <DataCell key={col.id}>
                                      <Thumb />
                                    </DataCell>
                                  );
                                }

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
            </RightScroll>
          </RightWrap>
        </ContentRow>
      </Box>
    </Root>
  );
};

export default AssetsRowTablePanel;
