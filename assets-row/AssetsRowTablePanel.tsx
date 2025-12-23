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
  styled,
} from '@material-ui/core';

import MenuIcon from '@material-ui/icons/Menu';
import ViewModuleIcon from '@material-ui/icons/ViewModule';
import ViewListIcon from '@material-ui/icons/ViewList';
import FilterListIcon from '@material-ui/icons/FilterList';

/* ───────────────────────── layout styles ───────────────────────── */

const Root = styled(Container)(({ theme }) => ({
  padding: 0,
}));

const Toolbar = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 44,
  padding: '0 8px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
}));

const ContentRow = styled('div')({
  display: 'flex',
  width: '100%',
});

/* ✅ fixed: remove horizontal scrollbar */
const TableWrap = styled(Paper)({
  flex: 1,
  width: '100%',
  overflowX: 'hidden',
  overflowY: 'auto',
});

/* ───────────────────────── left panel ───────────────────────── */

const LeftPanel = styled('div')(({ theme }) => ({
  width: 240,
  minWidth: 240,
  background: theme.palette.background.paper,
  borderRight: '1px solid rgba(255,255,255,0.12)',
}));

const LeftPanelHeader = styled('div')({
  height: 36,
  display: 'flex',
  alignItems: 'center',
  paddingLeft: 12,
  fontWeight: 600,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
});

/* ───────────────────────── table styles ───────────────────────── */

/* ✅ tighter header spacing */
const HeaderCell = styled(TableCell)({
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  padding: '4px 8px',
});

/* ✅ tighter body spacing */
const BodyCell = styled(TableCell)({
  padding: '4px 8px',
  fontSize: 12,
  color: '#9a9a9a',
});

/* ───────────────────────── columns ───────────────────────── */

const HEADER_COLUMNS = [
  { id: 'thumbnail', label: 'Thumbnail', minWidth: 120 },
  { id: 'name', label: 'Name', minWidth: 160 },

  /* ✅ MDL tightened */
  { id: 'mdl_work', label: 'MDL Work', minWidth: 80 },
  { id: 'mdl_appr', label: 'MDL Appr', minWidth: 80 },
  { id: 'mdl_submitted', label: 'MDL Submitted At', minWidth: 130 },

  { id: 'rig_work', label: 'RIG Work', minWidth: 80 },
  { id: 'rig_appr', label: 'RIG Appr', minWidth: 80 },
  { id: 'rig_submitted', label: 'RIG Submitted At', minWidth: 130 },

  { id: 'bld_work', label: 'BLD Work', minWidth: 80 },
  { id: 'bld_appr', label: 'BLD Appr', minWidth: 80 },
  { id: 'bld_submitted', label: 'BLD Submitted At', minWidth: 130 },

  { id: 'dsn_work', label: 'DSN Work', minWidth: 80 },
  { id: 'dsn_appr', label: 'DSN Appr', minWidth: 80 },
  { id: 'dsn_submitted', label: 'DSN Submitted At', minWidth: 130 },

  { id: 'ldv_work', label: 'LDV Work', minWidth: 80 },
  { id: 'ldv_appr', label: 'LDV Appr', minWidth: 80 },
  { id: 'ldv_submitted', label: 'LDV Submitted At', minWidth: 130 },

  { id: 'relation', label: 'Relation', minWidth: 90 },
];

/* ───────────────────────── component ───────────────────────── */

const AssetsRowTablePanel: React.FC = () => {
  const [barView, setBarView] = React.useState<'list' | 'group'>('group');
  const [leftOpen, setLeftOpen] = React.useState(true);

  const visibleColumns = React.useMemo(() => {
    if (barView === 'group') {
      return HEADER_COLUMNS.filter(
        (c) => c.id !== 'thumbnail' && c.id !== 'name'
      );
    }
    return HEADER_COLUMNS;
  }, [barView]);

  return (
    <Root maxWidth="xl">
      {/* ───── Toolbar ───── */}
      <Toolbar>
        <Box display="flex" alignItems="center" style={{ gap: 6 }}>
          <IconButton size="small" onClick={() => setBarView('list')}>
            <ViewListIcon
              fontSize="small"
              style={{ color: barView === 'list' ? '#00b7ff' : '#888' }}
            />
          </IconButton>

          <IconButton size="small" onClick={() => setBarView('group')}>
            <ViewModuleIcon
              fontSize="small"
              style={{ color: barView === 'group' ? '#00b7ff' : '#888' }}
            />
          </IconButton>

          {barView === 'group' && (
            <IconButton size="small" onClick={() => setLeftOpen(!leftOpen)}>
              <MenuIcon fontSize="small" />
            </IconButton>
          )}

          <Typography variant="subtitle2">Assets Row Table</Typography>
        </Box>

        <Box display="flex" alignItems="center" style={{ gap: 6 }}>
          <TextField
            size="small"
            variant="outlined"
            placeholder="Search Assets..."
          />
          <IconButton size="small">
            <FilterListIcon fontSize="small" />
          </IconButton>
        </Box>
      </Toolbar>

      {/* ───── Content ───── */}
      <ContentRow>
        {barView === 'group' && leftOpen && (
          <LeftPanel>
            <LeftPanelHeader>Groups</LeftPanelHeader>
            <Divider />
            <List dense>
              <ListItem button><ListItemText primary="camera (6)" /></ListItem>
              <ListItem button><ListItemText primary="character (94)" /></ListItem>
              <ListItem button><ListItemText primary="fx (1)" /></ListItem>
              <ListItem button><ListItemText primary="other (1)" /></ListItem>
            </List>
          </LeftPanel>
        )}

        <TableWrap>
          <Table
            stickyHeader
            size="small"
            style={{ tableLayout: 'fixed', width: '100%' }}
          >
            <TableHead>
              <TableRow>
                {visibleColumns.map((c) => (
                  <HeaderCell key={c.id} style={{ minWidth: c.minWidth }}>
                    {c.label}
                  </HeaderCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              <TableRow>
                {visibleColumns.map((c) => (
                  <BodyCell key={c.id}>—</BodyCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </TableWrap>
      </ContentRow>
    </Root>
  );
};

export default AssetsRowTablePanel;
