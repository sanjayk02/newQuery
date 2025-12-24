/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    AssetsRowTablePanel.tsx

  Description:
    High-density asset management table featuring:
    - Integrated Blue Category Rows (spanning full width)
    - Box-bordered workflow groups (MDL, RIG, etc.)
    - Synchronized Expand/Collapse logic
─────────────────────────────────────────────────────────────────────────── */

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
const BLUE_ACCENT = '#00b7ff'; // Bright blue for categories
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
  backgroundColor: '#1a1a1a', 
  height: 32,
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: '#252525',
  },
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

  // Define column groups for box borders
  const COLUMNS = [
    { id: 'thumb', label: 'THUMBE', width: 70 },
    { id: 'name', label: 'NAME', width: 180 },
    { id: 'mdl_work', label: 'MDL WORK', width: 100, isGroupStart: true },
    { id: 'mdl_appr', label: 'MDL APPR', width: 100 },
    { id: 'mdl_sub', label: 'MDL SUBMITTED AT', width: 150, isGroupEnd: true },
    { id: 'rig_work', label: 'RIG WORK', width: 100, isGroupStart: true },
    { id: 'rig_appr', label: 'RIG APPR', width: 100 },
    { id: 'rig_sub', label: 'RIG SUBMITTED AT', width: 150, isGroupEnd: true },
    { id: 'relation', label: 'RELATION', width: 100 },
  ];

  const MOCK_DATA = [
    {
      id: 'camera',
      label: 'CAMERA',
      assets: [
        { id: 'c1', name: 'camAim', mdl: 'In Progress', rig: 'Done' },
        { id: 'c2', name: 'camHero', mdl: 'Approved', rig: 'In Progress' },
      ],
    },
    {
      id: 'character',
      label: 'CHARACTER',
      assets: [
        { id: 'ch1', name: 'ando', mdl: 'Done', rig: 'Waiting' },
      ],
    },
  ];

  // Helper to apply the "box" borders requested
  const getBoxStyle = (col: any) => ({
    borderLeft: col.isGroupStart ? BOX_BORDER : 'none',
    borderRight: col.isGroupEnd ? BOX_BORDER : 'none',
  });

  return (
    <Root maxWidth={false}>
      <Toolbar>
        <Box display="flex" alignItems="center">
          <IconButton size="small" style={{ color: '#fff' }}><ViewListIcon fontSize="small" /></IconButton>
          <IconButton size="small" style={{ color: BLUE_ACCENT, marginLeft: 4 }}><ViewModuleIcon fontSize="small" /></IconButton>
          <Typography variant="subtitle2" style={{ marginLeft: 12, fontWeight: 600 }}>Assets Row Table</Typography>
        </Box>
        <Box display="flex" alignItems="center">
          <TextField 
            placeholder="Search Assets..." 
            variant="outlined" 
            size="small"
            InputProps={{ style: { height: 28, color: '#fff', backgroundColor: '#333', fontSize: 12, width: 220 }}}
          />
          <IconButton size="small" style={{ color: '#aaa', marginLeft: 8 }}><FilterListIcon fontSize="small" /></IconButton>
        </Box>
      </Toolbar>

      <Box overflow="auto" height="calc(100vh - 48px)">
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {COLUMNS.map(col => (
                <StyledHeaderCell key={col.id} style={{ minWidth: col.width, ...getBoxStyle(col) }}>
                  {col.label}
                </StyledHeaderCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {MOCK_DATA.map((group) => (
              <React.Fragment key={group.id}>
                {/* BLUE CATEGORY DIVIDER ROW */}
                <GroupTitleRow onClick={() => toggleGroup(group.id)}>
                  <GroupTitleCell colSpan={COLUMNS.length}>
                    <Box display="flex" alignItems="center">
                      {openGroups[group.id] ? 
                        <ExpandLessIcon style={{ fontSize: 18, color: '#666', marginRight: 6 }} /> : 
                        <ExpandMoreIcon style={{ fontSize: 18, color: '#666', marginRight: 6 }} />
                      }
                      {group.label}
                    </Box>
                  </GroupTitleCell>
                </GroupTitleRow>

                {/* ASSET DATA ROWS */}
                {openGroups[group.id] && group.assets.map((asset) => (
                  <TableRow key={asset.id} hover>
                    <DataCell><Thumb /></DataCell>
                    <DataCell style={{ color: '#ddd' }}>{asset.name}</DataCell>
                    
                    {/* MDL GROUP */}
                    <DataCell style={getBoxStyle(COLUMNS[2])}>{asset.mdl}</DataCell>
                    <DataCell>Approved</DataCell>
                    <DataCell style={getBoxStyle(COLUMNS[4])}>2023-11-20</DataCell>
                    
                    {/* RIG GROUP */}
                    <DataCell style={getBoxStyle(COLUMNS[5])}>{asset.rig}</DataCell>
                    <DataCell>—</DataCell>
                    <DataCell style={getBoxStyle(COLUMNS[7])}>—</DataCell>
                    
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
