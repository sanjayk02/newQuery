/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    AssetsRowTablePanel.tsx
  
  Implementation Notes:
    - Adds white "Group Title" rows inside the table body.
    - Implements color-coded status logic (Orange, Green, Blue).
    - Ensures 1:1 row height alignment between Sidebar and Table.
─────────────────────────────────────────────────────────────────────────── */

import React from 'react';
import {
  Box, Container, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  Typography, TextField, IconButton, List, ListItem, ListItemText,
  Collapse, styled,
} from '@material-ui/core';
import {
  Menu as MenuIcon, ViewModule as ViewModuleIcon, ViewList as ViewListIcon,
  FilterList as FilterListIcon, ExpandLess as ExpandLessIcon, ExpandMore as ExpandMoreIcon
} from '@material-ui/icons';

// --- Styled Components ---

const Root = styled(Container)({
  position: 'relative',
  padding: 0,
  backgroundColor: '#1e1e1e',
  minHeight: '100vh',
});

const Toolbar = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: '#2d2d2d',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  padding: theme.spacing(0.5, 1),
  height: 48,
}));

const LeftPanel = styled('div')({
  width: 260,
  minWidth: 260,
  backgroundColor: '#252525',
  borderRight: '1px solid rgba(255,255,255,0.12)',
  display: 'flex',
  flexDirection: 'column',
});

const TableWrap = styled(Paper)({
  flex: 1,
  overflowX: 'auto',
  backgroundColor: '#1e1e1e',
  borderRadius: 0,
  boxShadow: 'none',
  // Custom scrollbar styling
  '&::-webkit-scrollbar': { height: 8 },
  '&::-webkit-scrollbar-thumb': { backgroundColor: '#444', borderRadius: 4 },
});

const HeaderCell = styled(TableCell)({
  fontWeight: 700,
  textTransform: 'uppercase',
  fontSize: 10,
  padding: '12px 10px',
  backgroundColor: '#2d2d2d !important',
  color: '#ffffff',
  borderBottom: '1px solid #444',
  whiteSpace: 'nowrap',
});

const DataCell = styled(TableCell)({
  padding: '8px 10px',
  fontSize: 12,
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  height: 48, 
  color: '#ccc',
  whiteSpace: 'nowrap',
});

// Row for the "Top Node" group title inside the table
const GroupHeaderRow = styled(TableRow)({
  backgroundColor: '#1e1e1e',
  '& td': {
    borderBottom: 'none',
    paddingTop: 16,
    paddingBottom: 4,
  }
});

const GroupTitleLabel = styled('div')({
  backgroundColor: '#ffffff', // High contrast white label
  color: '#000000',
  display: 'inline-block',
  padding: '2px 14px',
  borderRadius: '2px',
  fontWeight: 800,
  fontSize: 14,
  textTransform: 'capitalize',
});

// --- Helpers & Mock Data ---

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'done': return '#4caf50';      // Green
    case 'approved': return '#8bc34a';  // Light Green
    case 'in progress': return '#ff9800'; // Orange
    case 'waiting': return '#2196f3';    // Blue
    case 'pending': return '#9e9e9e';    // Gray
    default: return '#555';
  }
};

const HEADER_COLUMNS = [
  { id: 'thumbnail', label: 'Thumbnail', minWidth: 100 },
  { id: 'name', label: 'Name', minWidth: 150 },
  { id: 'mdl_work', label: 'MDL WORK', minWidth: 110 },
  { id: 'mdl_appr', label: 'MDL APPR', minWidth: 110 },
  { id: 'mdl_submitted', label: 'MDL SUBMITTED AT', minWidth: 140 },
  { id: 'rig_work', label: 'RIG WORK', minWidth: 110 },
  { id: 'rig_appr', label: 'RIG APPR', minWidth: 110 },
  { id: 'rig_submitted', label: 'RIG SUBMITTED AT', minWidth: 140 },
  { id: 'bld_work', label: 'BLD WORK', minWidth: 110 },
  { id: 'bld_appr', label: 'BLD APPR', minWidth: 110 },
  { id: 'bld_submitted', label: 'BLD SUBMITTED AT', minWidth: 140 },
  { id: 'dsn_work', label: 'DSN WORK', minWidth: 110 },
  { id: 'dsn_appr', label: 'DSN APPR', minWidth: 110 },
  { id: 'dsn_submitted', label: 'DSN SUBMITTED AT', minWidth: 140 },
  { id: 'relation', label: 'RELATION', minWidth: 90 },
];

const MOCK_DATA = [
  {
    id: 'camera',
    label: 'Camera',
    assets: [
      { id: 'c1', name: 'camAim', mdl_work: 'In Progress', mdl_appr: 'Pending', mdl_submitted: '2023-11-20', rig_work: 'In Progress', bld_work: 'Waiting', dsn_work: 'Done', dsn_appr: 'Approved', dsn_submitted: '2023-10-15', relation: '-' },
      { id: 'c2', name: 'camHero', mdl_work: 'In Progress', mdl_appr: 'Pending', mdl_submitted: '2023-11-20', rig_work: 'In Progress', bld_work: 'Waiting', dsn_work: 'Done', dsn_appr: 'Approved', dsn_submitted: '2023-10-15', relation: '-' },
      { id: 'c3', name: 'camWide', mdl_work: 'In Progress', mdl_appr: 'Pending', mdl_submitted: '2023-11-20', rig_work: 'In Progress', bld_work: 'Waiting', dsn_work: 'Done', dsn_appr: 'Approved', dsn_submitted: '2023-10-15', relation: '-' },
    ]
  },
  {
    id: 'character',
    label: 'Character',
    assets: [
      { id: 'ch1', name: 'ando', mdl_work: 'Done', mdl_appr: 'Pending', mdl_submitted: '2023-11-20', rig_work: 'In Progress', bld_work: 'Waiting', dsn_work: 'Done', dsn_appr: 'Approved', dsn_submitted: '2023-10-15', relation: '-' },
      { id: 'ch2', name: 'baseFemale', mdl_work: 'Done', mdl_appr: 'Pending', mdl_submitted: '2023-11-20', rig_work: 'In Progress', bld_work: 'Waiting', dsn_work: 'Done', dsn_appr: 'Approved', dsn_submitted: '2023-10-15', relation: '-' },
      { id: 'ch3', name: 'baseMale', mdl_work: 'In Progress', mdl_appr: 'Approved', mdl_submitted: '2023-11-20', rig_work: 'In Progress', bld_work: 'Waiting', dsn_work: 'Done', dsn_appr: 'Approved', dsn_submitted: '2023-10-15', relation: '-' },
      { id: 'ch4', name: 'chris', mdl_work: 'In Progress', mdl_appr: 'Approved', mdl_submitted: '2023-11-20', rig_work: 'In Progress', bld_work: 'Waiting', dsn_work: 'Done', dsn_appr: 'Approved', dsn_submitted: '2023-10-15', relation: '-' },
    ]
  }
];

// --- Main Component ---

const AssetsRowTablePanel: React.FC = () => {
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({ camera: true, character: true });

  const toggleGroup = (id: string) => setOpenGroups(p => ({ ...p, [id]: !p[id] }));

  // Filter columns for Group Category View
  const activeCols = HEADER_COLUMNS.filter(c => c.id !== 'thumbnail' && c.id !== 'name');

  return (
    <Root maxWidth={false}>
      <Toolbar>
        <Box display="flex" alignItems="center" style={{ gap: 12 }}>
          <ViewListIcon style={{ fontSize: 18, color: '#666' }} />
          <ViewModuleIcon style={{ fontSize: 18, color: '#00b7ff' }} />
          <MenuIcon style={{ fontSize: 18, color: '#fff' }} />
          <Typography variant="subtitle2" style={{ color: '#fff', fontWeight: 600 }}>Assets Row Table</Typography>
        </Box>
        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
          <TextField
            placeholder="Search Assets..."
            variant="outlined"
            size="small"
            InputProps={{ style: { height: 28, color: '#fff', fontSize: 12, backgroundColor: '#333' } }}
          />
          <FilterListIcon style={{ fontSize: 18, color: '#666' }} />
        </Box>
      </Toolbar>

      <Box display="flex" height="calc(100vh - 48px)">
        {/* LEFT PANEL SIDEBAR */}
        <LeftPanel>
          <Box p={1} display="flex" justifyContent="space-between" alignItems="center">
            <Typography style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>Groups</Typography>
            <Typography style={{ color: '#666', fontSize: 10 }}>(mock)</Typography>
          </Box>
          <List dense disablePadding>
            {MOCK_DATA.map(g => (
              <React.Fragment key={g.id}>
                <ListItem button onClick={() => toggleGroup(g.id)} style={{ height: 32 }}>
                  <ListItemText 
                    primary={`${g.label} (${g.assets.length})`} 
                    primaryTypographyProps={{ style: { color: '#fff', fontSize: 12, fontWeight: 600 } }} 
                  />
                  {openGroups[g.id] ? <ExpandLessIcon style={{ color: '#666' }} /> : <ExpandMoreIcon style={{ color: '#666' }} />}
                </ListItem>
                <Collapse in={openGroups[g.id]}>
                  {g.assets.map(a => (
                    <ListItem key={a.id} button style={{ paddingLeft: 32, height: 48 }}>
                      <Box width={30} height={22} bgcolor="#444" mr={1.5} borderRadius={1} border="1px solid #555" />
                      <Typography style={{ color: '#aaa', fontSize: 12 }}>{a.name}</Typography>
                    </ListItem>
                  ))}
                </Collapse>
              </React.Fragment>
            ))}
          </List>
        </LeftPanel>

        {/* RIGHT TABLE PANEL */}
        <TableWrap>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {activeCols.map(c => (
                  <HeaderCell key={c.id} style={{ minWidth: c.minWidth }}>{c.label}</HeaderCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {MOCK_DATA.map(group => (
                <React.Fragment key={group.id}>
                  {/* TOP NODE GROUP HEADER */}
                  <GroupHeaderRow>
                    <DataCell colSpan={activeCols.length}>
                      <GroupTitleLabel>{group.label}</GroupTitleLabel>
                    </DataCell>
                  </GroupHeaderRow>

                  {/* ASSET DATA ROWS */}
                  {openGroups[group.id] && group.assets.map(asset => (
                    <TableRow key={asset.id} hover>
                      {activeCols.map(col => {
                        const val = asset[col.id as keyof typeof asset] || '—';
                        
                        // Apply specific colors to status columns
                        const isStatusCol = ['work', 'appr', 'submitted'].some(k => col.id.includes(k));
                        const color = isStatusCol ? getStatusColor(val) : '#ccc';
                        
                        return (
                          <DataCell key={col.id} style={{ color }}>
                            {val}
                          </DataCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
      </Box>
    </Root>
  );
};

export default AssetsRowTablePanel;
