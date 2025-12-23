/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    AssetsRowTablePanel.tsx

  Module Description:
    Starter implementation for the "Assets Row" page.

  Notes:
    - Group Category View shows a left panel (Groups) with Thumbnail + Name list.
    - In Group Category View the main table hides Thumbnail + Name columns.
    - Uses Material-UI v4 (no TextField size prop).
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
  Divider,
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

const Root = styled(Container)(({ theme }) => ({
  position: 'relative',
  padding: 0,
  '& > *': {
    padding: theme.spacing(1),
  },
}));

const Toolbar = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: theme.palette.background.paper,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  padding: theme.spacing(1),
  height: 48,
  boxSizing: 'border-box',
}));

const ContentRow = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  width: '100%',
  background: theme.palette.background.paper,
}));

const LeftPanel = styled('div')(({ theme }) => ({
  width: 260,
  minWidth: 260,
  maxWidth: 260,
  backgroundColor: 'rgba(255,255,255,0.08)',
  borderRight: '1px solid rgba(255,255,255,0.12)',
  display: 'flex',
  flexDirection: 'column',
}));

const LeftPanelHeader = styled('div')(({ theme }) => ({
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingLeft: 12,
  paddingRight: 8,
  backgroundColor: theme.palette.background.paper,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  boxSizing: 'border-box',
}));

const LeftPanelBody = styled('div')({
  overflowY: 'auto',
  overflowX: 'hidden',
  flex: 1,
});

const TableWrap = styled(Paper)({
  flex: 1,
  width: '100%',
  overflowX: 'hidden',
  overflowY: 'auto',
});

const HeaderCell = styled(TableCell)({
  fontWeight: 600,
  textTransform: 'uppercase',
  fontSize: 12,
  letterSpacing: 0.2,
  whiteSpace: 'nowrap',
  paddingLeft: 10,
  paddingRight: 10,
});

const EmptyCell = styled(TableCell)({
  color: '#b0b0b0',
  paddingLeft: 10,
  paddingRight: 10,
});

const Thumb = styled('div')({
  width: 26,
  height: 18,
  borderRadius: 2,
  background: 'rgba(255,255,255,0.18)',
  border: '1px solid rgba(0,0,0,0.35)',
  flex: '0 0 auto',
});

const RowItem = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  minWidth: 0,
});

const RowName = styled('div')({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 13,
});

/** Basic header columns */
const HEADER_COLUMNS: Array<{ id: string; label: string; minWidth?: number }> = [
  { id: 'thumbnail', label: 'Thumbnail', minWidth: 120 },
  { id: 'name', label: 'Name', minWidth: 150 },
  { id: 'mdl_work', label: 'MDL Work', minWidth: 90 },
  { id: 'mdl_appr', label: 'MDL Appr', minWidth: 90 },
  { id: 'mdl_submitted', label: 'MDL Submitted At', minWidth: 120 },
  { id: 'rig_work', label: 'RIG Work', minWidth: 90 },
  { id: 'rig_appr', label: 'RIG Appr', minWidth: 90 },
  { id: 'rig_submitted', label: 'RIG Submitted At', minWidth: 120 },
  { id: 'bld_work', label: 'BLD Work', minWidth: 90 },
  { id: 'bld_appr', label: 'BLD Appr', minWidth: 90 },
  { id: 'bld_submitted', label: 'BLD Submitted At', minWidth: 120 },
  { id: 'dsn_work', label: 'DSN Work', minWidth: 90 },
  { id: 'dsn_appr', label: 'DSN Appr', minWidth: 90 },
  { id: 'dsn_submitted', label: 'DSN Submitted At', minWidth: 120 },
  { id: 'ldv_work', label: 'LDV Work', minWidth: 90 },
  { id: 'ldv_appr', label: 'LDV Appr', minWidth: 90 },
  { id: 'ldv_submitted', label: 'LDV Submitted At', minWidth: 120 },
  { id: 'relation', label: 'Relation', minWidth: 70 },
];

/** Mock group data: group -> children asset items */
type MockAsset = { id: string; name: string; thumb?: string };
type MockGroup = { id: string; label: string; count: number; assets: MockAsset[] };

const MOCK_GROUPS: MockGroup[] = [
  {
    id: 'camera',
    label: 'camera',
    count: 6,
    assets: [
      { id: 'camAim', name: 'camAim' },
      { id: 'camHero', name: 'camHero' },
      { id: 'camWide', name: 'camWide' },
    ],
  },
  {
    id: 'character',
    label: 'character',
    count: 94,
    assets: [
      { id: 'ando', name: 'ando' },
      { id: 'baseFemale', name: 'baseFemale' },
      { id: 'baseMale', name: 'baseMale' },
      { id: 'chris', name: 'chris' },
    ],
  },
  {
    id: 'fx',
    label: 'fx',
    count: 1,
    assets: [{ id: 'fx', name: 'fx' }],
  },
  {
    id: 'other',
    label: 'other',
    count: 1,
    assets: [{ id: 'other', name: 'other' }],
  },
];

const AssetsRowTablePanel: React.FC = () => {
  const [search, setSearch] = React.useState('');
  // barView:
  //  - 'list'  : normal table view
  //  - 'group' : Group Category view with left panel
  const [barView, setBarView] = React.useState<'list' | 'group'>('list');
  const [leftOpen, setLeftOpen] = React.useState(true);

  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    MOCK_GROUPS.forEach((g) => (init[g.id] = true));
    return init;
  });

  // In group-category view, we hide Thumbnail + Name because left panel will show them.
  const headerColumns = React.useMemo(() => {
    if (barView !== 'group') return HEADER_COLUMNS;
    return HEADER_COLUMNS.filter((c) => c.id !== 'thumbnail' && c.id !== 'name');
  }, [barView]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Root maxWidth="xl">
      <Box>
        <Toolbar>
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            {/* barView toggle */}
            <IconButton
              aria-label="List View"
              onClick={() => setBarView('list')}
              title="List View"
              style={{ padding: 6 }}
            >
              <ViewListIcon style={{ fontSize: 18, color: barView === 'list' ? '#00b7ff' : '#b0b0b0' }} />
            </IconButton>

            <IconButton
              aria-label="Group Category View"
              onClick={() => setBarView('group')}
              title="Group Category View"
              style={{ padding: 6 }}
            >
              <ViewModuleIcon style={{ fontSize: 18, color: barView === 'group' ? '#00b7ff' : '#b0b0b0' }} />
            </IconButton>

            {/* Left panel show/hide (only relevant in group view) */}
            {barView === 'group' && (
              <IconButton
                aria-label="Toggle left panel"
                onClick={() => setLeftOpen((v) => !v)}
                title={leftOpen ? 'Hide left panel' : 'Show left panel'}
                style={{ padding: 6 }}
              >
                <MenuIcon style={{ fontSize: 18 }} />
              </IconButton>
            )}

            <Typography variant="subtitle2">Assets Row Table</Typography>
          </Box>

          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <TextField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Assets..."
              variant="outlined"
              margin="dense"
              style={{ width: 260 }}
            />
            <IconButton aria-label="filter" title="Filter" style={{ padding: 6 }}>
              <FilterListIcon style={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Toolbar>

        <ContentRow>
          {barView === 'group' && leftOpen && (
            <LeftPanel>
              <LeftPanelHeader>
                <Typography variant="subtitle2" style={{ fontSize: 12, fontWeight: 600 }}>
                  Groups
                </Typography>
                <Typography variant="caption" style={{ opacity: 0.7 }}>
                  (mock)
                </Typography>
              </LeftPanelHeader>

              <Divider />

              <LeftPanelBody>
                <List dense disablePadding>
                  {MOCK_GROUPS.map((g) => {
                    const isOpen = !!openGroups[g.id];
                    return (
                      <React.Fragment key={g.id}>
                        {/* Group row */}
                        <ListItem button onClick={() => toggleGroup(g.id)} style={{ paddingLeft: 10 }}>
                          <ListItemText
                            primary={
                              <Typography style={{ fontSize: 13, fontWeight: 600 }}>
                                {g.label} ({g.count})
                              </Typography>
                            }
                          />
                          {isOpen ? (
                            <ExpandLessIcon style={{ fontSize: 18, opacity: 0.8 }} />
                          ) : (
                            <ExpandMoreIcon style={{ fontSize: 18, opacity: 0.8 }} />
                          )}
                        </ListItem>

                        {/* Assets under group: Thumbnail + Name */}
                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                          <List dense disablePadding>
                            {g.assets.map((a) => (
                              <ListItem
                                key={a.id}
                                button
                                style={{
                                  paddingLeft: 24,
                                  paddingRight: 10,
                                }}
                              >
                                <RowItem>
                                  <Thumb />
                                  <RowName title={a.name}>{a.name}</RowName>
                                </RowItem>
                              </ListItem>
                            ))}
                          </List>
                        </Collapse>
                      </React.Fragment>
                    );
                  })}
                </List>
              </LeftPanelBody>
            </LeftPanel>
          )}

          <TableWrap>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  {headerColumns.map((c) => (
                    <HeaderCell key={c.id} style={c.minWidth ? { minWidth: c.minWidth } : undefined}>
                      {c.label}
                    </HeaderCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {/* Placeholder row until API wiring is done */}
                <TableRow>
                  {headerColumns.map((c) => (
                    <EmptyCell key={c.id}>—</EmptyCell>
                  ))}
                </TableRow>

                <TableRow>
                  <TableCell colSpan={headerColumns.length}>
                    <Typography variant="body2" style={{ opacity: 0.7 }}>
                      Next: wire API + real group tree. In <b>Group Category View</b> we hide Thumbnail + Name
                      in the table and show them in the left panel.
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableWrap>
        </ContentRow>
      </Box>
    </Root>
  );
};

export default AssetsRowTablePanel;
