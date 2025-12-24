import React from 'react';
import {
  Box,
  Container,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  TextField,
  IconButton,
  styled,
} from '@material-ui/core';

import ViewModuleIcon from '@material-ui/icons/ViewModule';
import ViewListIcon from '@material-ui/icons/ViewList';
import FilterListIcon from '@material-ui/icons/FilterList';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';

// ---------------------------------------------------------------------------
// Design Constants
// ---------------------------------------------------------------------------
const PANEL_BG = '#1e1e1e';
const HEADER_BG = '#2d2d2d';
const BORDER_COLOR = 'rgba(255,255,255,0.12)';
const BLUE_ACCENT = '#00b7ff'; // The specific blue from your image
const BOX_BORDER = '2px solid rgba(255,255,255,0.28)';

// ---------------------------------------------------------------------------
// Styled Components
// ---------------------------------------------------------------------------
const Root = styled(Container)({
  padding: 0,
  backgroundColor: PANEL_BG,
  minHeight: '100vh',
  color: '#fff',
});

const Toolbar = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: HEADER_BG,
  padding: '0 12px',
  height: 48,
  borderBottom: `1px solid ${BORDER_COLOR}`,
});

const StyledHeaderCell = styled(TableCell)({
  backgroundColor: HEADER_BG,
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  borderBottom: `1px solid ${BORDER_COLOR}`,
  padding: '8px 12px',
  whiteSpace: 'nowrap',
});

const GroupTitleRow = styled(TableRow)({
  backgroundColor: '#1a1a1a', // Slightly darker than panel for the header row
  height: 32,
  cursor: 'pointer',
});

const GroupTitleCell = styled(TableCell)({
  padding: '0 12px',
  borderBottom: `1px solid rgba(255,255,255,0.08)`,
  color: BLUE_ACCENT,
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
});

const DataCell = styled(TableCell)({
  color: '#b0b0b0',
  fontSize: 12,
  height: 44,
  borderBottom: `1px solid rgba(255,255,255,0.05)`,
  padding: '0 12px',
});

const Thumb = styled('div')({
  width: 32,
  height: 22,
  backgroundColor: '#333',
  border: '1px solid rgba(255,255,255,0.2)',
});

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function AssetsRowTablePanel() {
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({
    camera: true,
    character: true,
  });

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const COLUMNS = [
    { id: 'thumb', label: 'THUMBE', width: 70 },
    { id: 'name', label: 'NAME', width: 180 },
    { id: 'mdl_work', label: 'MDL WORK', width: 100, groupStart: true },
    { id: 'mdl_appr', label: 'MDL APPR', width: 100 },
    { id: 'mdl_sub', label: 'MDL SUBMITTED AT', width: 140, groupEnd: true },
    { id: 'rig_work', label: 'RIG WORK', width: 100, groupStart: true },
    { id: 'rig_appr', label: 'RIG APPR', width: 100 },
    { id: 'rig_sub', label: 'RIG SUBMITTED AT', width: 140, groupEnd: true },
    { id: 'relation', label: 'RELATION', width: 100 },
  ];

  const MOCK_DATA = [
    {
      id: 'camera',
      label: 'CAMERA',
      assets: [
        { id: '1', name: 'camAim', mdl: 'Done', rig: 'In Progress' },
        { id: '2', name: 'camHero', mdl: 'Done', rig: 'In Progress' },
      ],
    },
    {
      id: 'character',
      label: 'CHARACTER',
      assets: [
        { id: '3', name: 'ando', mdl: 'In Progress', rig: 'Waiting' },
      ],
    },
  ];

  const getBorderStyle = (col: any) => ({
    borderLeft: col.groupStart ? BOX_BORDER : 'none',
    borderRight: col.groupEnd ? BOX_BORDER : 'none',
  });

  return (
    <Root maxWidth={false}>
      <Toolbar>
        <Box display="flex" alignItems="center">
          <IconButton size="small" style={{ color: '#fff' }}><ViewListIcon fontSize="small" /></IconButton>
          <IconButton size="small" style={{ color: BLUE_ACCENT }}><ViewModuleIcon fontSize="small" /></IconButton>
          <Typography variant="subtitle2" style={{ marginLeft: 8 }}>Assets Row Table</Typography>
        </Box>
        <TextField 
          placeholder="Search Assets..." 
          variant="outlined" 
          size="small"
          InputProps={{ style: { height: 28, color: '#fff', backgroundColor: '#333', fontSize: 12 }}}
        />
      </Toolbar>

      <Box overflow="auto" height="calc(100vh - 48px)">
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {COLUMNS.map(col => (
                <StyledHeaderCell key={col.id} style={{ minWidth: col.width, ...getBorderStyle(col) }}>
                  {col.label}
                </StyledHeaderCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {MOCK_DATA.map((group) => (
              <React.Fragment key={group.id}>
                {/* THIS IS THE BLUE CATEGORY ROW FROM YOUR IMAGE */}
                <GroupTitleRow onClick={() => toggleGroup(group.id)}>
                  <GroupTitleCell colSpan={COLUMNS.length}>
                    <Box display="flex" alignItems="center">
                      {openGroups[group.id] ? <ExpandLessIcon style={{fontSize: 16, color: '#666'}}/> : <ExpandMoreIcon style={{fontSize: 16, color: '#666'}}/>}
                      <span style={{ marginLeft: 4 }}>{group.label}</span>
                    </Box>
                  </GroupTitleCell>
                </GroupTitleRow>

                {/* ASSET DATA ROWS */}
                {openGroups[group.id] && group.assets.map((asset) => (
                  <TableRow key={asset.id}>
                    <DataCell><Thumb /></DataCell>
                    <DataCell style={{ color: '#ddd' }}>{asset.name}</DataCell>
                    <DataCell style={getBorderStyle(COLUMNS[2])}>{asset.mdl}</DataCell>
                    <DataCell>Approved</DataCell>
                    <DataCell style={getBorderStyle(COLUMNS[4])}>2023-11-20</DataCell>
                    <DataCell style={getBorderStyle(COLUMNS[5])}>{asset.rig}</DataCell>
                    <DataCell>—</DataCell>
                    <DataCell style={getBorderStyle(COLUMNS[7])}>—</DataCell>
                    <DataCell>Master</DataCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Root>
  );
}
