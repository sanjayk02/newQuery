/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    AssetsRowTablePanel.tsx

  Module Description:
    Assets Row Table with group/list view, synced sidebar, search & selection.
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

/* ───────────────────────── Constants ───────────────────────── */

const ASSET_ROW_H = 44;
const GROUP_ROW_H = 32;

/* ───────────────────────── Styled Components ───────────────────────── */

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
}));

const ContentRow = styled('div')({
  display: 'flex',
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
  padding: '0 8px 0 12px',
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
});

const Thumb = styled('div')({
  width: 32,
  height: 24,
  borderRadius: 2,
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.2)',
});

const RowItem = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  height: ASSET_ROW_H,
});

/* ───────────────────────── Data ───────────────────────── */

const HEADER_COLUMNS = [
  { id: 'name', label: 'Name', minWidth: 160 },
  { id: 'mdl_work', label: 'MDL Work', minWidth: 100 },
  { id: 'mdl_appr', label: 'MDL Appr', minWidth: 100 },
  { id: 'mdl_submitted', label: 'MDL Submitted', minWidth: 140 },
  { id: 'rig_work', label: 'RIG Work', minWidth: 100 },
  { id: 'rig_appr', label: 'RIG Appr', minWidth: 100 },
  { id: 'relation', label: 'Relation', minWidth: 100 },
];

const generateMockData = (id: string, name: string) => ({
  id,
  name,
  mdl_work: Math.random() > 0.5 ? 'In Progress' : 'Done',
  mdl_appr: Math.random() > 0.5 ? 'Pending' : 'Approved',
  mdl_submitted: '2023-11-20',
  rig_work: 'Waiting',
  rig_appr: '—',
  relation: 'Master',
});

const MOCK_GROUPS = [
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
];

/* ───────────────────────── Component ───────────────────────── */

const AssetsRowTablePanel: React.FC = () => {
  const [view, setView] = React.useState<'group' | 'list'>('group');
  const [leftOpen, setLeftOpen] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({
    camera: true,
    character: true,
  });

  const toggleGroup = (id: string) =>
    setOpenGroups((s) => ({ ...s, [id]: !s[id] }));

  const filteredGroups = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return MOCK_GROUPS;

    return MOCK_GROUPS
      .map((g) => ({
        ...g,
        assets: g.assets.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.id.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.assets.length > 0);
  }, [search]);

  return (
    <Root maxWidth={false}>
      <Toolbar>
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton onClick={() => setView('list')}>
            <ViewListIcon style={{ color: view === 'list' ? '#00b7ff' : '#aaa' }} />
          </IconButton>
          <IconButton onClick={() => setView('group')}>
            <ViewModuleIcon style={{ color: view === 'group' ? '#00b7ff' : '#aaa' }} />
          </IconButton>
          {view === 'group' && (
            <IconButton onClick={() => setLeftOpen((v) => !v)}>
              <MenuIcon style={{ color: '#fff' }} />
            </IconButton>
          )}
          <Typography style={{ color: '#fff', fontWeight: 600 }}>
            Assets Row Table
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" gap={1}>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets…"
            size="small"
            variant="outlined"
            InputProps={{
              style: { background: '#444', color: '#fff', height: 30 },
            }}
          />
          <IconButton>
            <FilterListIcon style={{ color: '#aaa' }} />
          </IconButton>
        </Box>
      </Toolbar>

      <ContentRow>
        {view === 'group' && leftOpen && (
          <LeftPanel>
            <LeftPanelHeader>
              <Typography style={{ color: '#fff', fontWeight: 600 }}>
                Groups
              </Typography>
            </LeftPanelHeader>

            <LeftPanelBody>
              <List disablePadding dense>
                {filteredGroups.map((g) => {
                  const open = openGroups[g.id];
                  return (
                    <React.Fragment key={g.id}>
                      <ListItem
                        button
                        onClick={() => toggleGroup(g.id)}
                        style={{ height: GROUP_ROW_H }}
                      >
                        <ListItemText
                          primary={`${g.label} (${g.assets.length})`}
                          primaryTypographyProps={{ style: { color: '#fff' } }}
                        />
                        {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </ListItem>

                      <Collapse in={open}>
                        {g.assets.map((a) => {
                          const active = selectedId === a.id;
                          return (
                            <ListItem
                              key={a.id}
                              button
                              onClick={() => setSelectedId(a.id)}
                              style={{
                                paddingLeft: 24,
                                height: ASSET_ROW_H,
                                background: active
                                  ? 'rgba(0,183,255,0.15)'
                                  : undefined,
                                borderLeft: active
                                  ? '2px solid #00b7ff'
                                  : '2px solid transparent',
                              }}
                            >
                              <RowItem>
                                <Thumb />
                                <Typography style={{ color: '#ddd' }}>
                                  {a.name}
                                </Typography>
                              </RowItem>
                            </ListItem>
                          );
                        })}
                      </Collapse>
                    </React.Fragment>
                  );
                })}
              </List>
            </LeftPanelBody>
          </LeftPanel>
        )}

        <TableWrap>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {HEADER_COLUMNS.map((c) => (
                  <HeaderCell key={c.id} style={{ minWidth: c.minWidth }}>
                    {c.label}
                  </HeaderCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {filteredGroups.map((g) => (
                <React.Fragment key={g.id}>
                  {view === 'list' && (
                    <TableRow>
                      <DataCell
                        colSpan={HEADER_COLUMNS.length}
                        style={{ fontWeight: 700, color: '#00b7ff' }}
                      >
                        {g.label.toUpperCase()}
                      </DataCell>
                    </TableRow>
                  )}

                  {(view === 'list' || openGroups[g.id]) &&
                    g.assets.map((a) => {
                      const active = selectedId === a.id;
                      return (
                        <TableRow
                          key={a.id}
                          hover
                          onClick={() => setSelectedId(a.id)}
                          style={{
                            background: active
                              ? 'rgba(0,183,255,0.12)'
                              : undefined,
                          }}
                        >
                          {HEADER_COLUMNS.map((c) => (
                            <DataCell key={c.id}>
                              {(a as any)[c.id] ?? '—'}
                            </DataCell>
                          ))}
                        </TableRow>
                      );
                    })}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
      </ContentRow>
    </Root>
  );
};

export default AssetsRowTablePanel;
