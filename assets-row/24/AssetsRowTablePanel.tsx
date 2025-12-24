/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    AssetsRowTablePanel.tsx

  Module Description:
    Synchronized group sidebar + table with colored department containers
    and white node group headers. Fixes optional chaining syntax errors.
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

// ---------------------------------------------------------------------------
// Department Grouping Configuration
// ---------------------------------------------------------------------------
const DEPT_GROUPS = [
  { id: 'mdl', label: 'MDL', color: '#e53935', cols: ['mdl_work', 'mdl_appr', 'mdl_submitted'] },
  { id: 'rig', label: 'RIG', color: '#fbc02d', cols: ['rig_work', 'rig_appr', 'rig_submitted'] },
  { id: 'bld', label: 'BLD', color: '#d81b60', cols: ['bld_work', 'bld_appr', 'bld_submitted'] },
  { id: 'dsn', label: 'DSN', color: '#00bcd4', cols: ['dsn_work', 'dsn_appr', 'dsn_submitted'] },
  { id: 'ldv', label: 'LDV', color: '#43a047', cols: ['ldv_work', 'ldv_appr', 'ldv_submitted'] },
];

// ---------------------------------------------------------------------------
// Styled Components
// ---------------------------------------------------------------------------

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

const LeftPanelBody = styled('div')({
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
});

const TableShell = styled(Paper)({
  flex: 1,
  backgroundColor: '#1e1e1e',
  borderRadius: 0,
  boxShadow: 'none',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
});

const TableScroller = styled('div')({
  flex: 1,
  overflow: 'auto',
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

interface GroupedCellProps {
  borderColor?: string;
  isFirstInDept?: boolean;
  isLastInDept?: boolean;
  statusColor?: string;
}

/**
 * Custom Data Cell with vertical colored borders for department grouping.
 * Props are destructured to avoid TS2339 errors in MUI v4.
 */
const GroupedDataCell = styled(TableCell)<GroupedCellProps>(({ 
  borderColor, 
  isFirstInDept, 
  isLastInDept, 
  statusColor 
}) => ({
  fontSize: 12,
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  padding: '0 10px',
  height: ASSET_ROW_H,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  color: statusColor || '#b0b0b0',
  // Create the "container" look with colored borders
  borderLeft: isFirstInDept && borderColor ? `1px solid ${borderColor}` : 'none',
  borderRight: isLastInDept && borderColor ? `1px solid ${borderColor}` : 'none',
  backgroundColor: isFirstInDept || isLastInDept ? 'rgba(255,255,255,0.01)' : 'transparent',
}));

const GroupTitleLabel = styled('div')({
  backgroundColor: '#ffffff',
  color: '#000000',
  display: 'inline-block',
  padding: '2px 14px',
  borderRadius: '2px',
  fontWeight: 800,
  fontSize: 13,
  textTransform: 'capitalize',
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getStatusColor = (val: any) => {
  if (val === 'Done' || val === 'Approved') return '#4caf50';
  if (val === 'In Progress') return '#ff9800';
  if (val === 'Waiting') return '#2196f3';
  return undefined;
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const AssetsRowTablePanel: React.FC = () => {
  const [search, setSearch] = React.useState('');
  const [barView, setBarView] = React.useState<'list' | 'group'>('group');
  const [leftOpen, setLeftOpen] = React.useState(true);
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({
    camera: true, character: true, fx: true, other: true,
  });

  const leftScrollRef = React.useRef<HTMLDivElement | null>(null);
  const tableScrollRef = React.useRef<HTMLDivElement | null>(null);

  const syncScroll = (from: 'left' | 'table') => {
    const leftEl = leftScrollRef.current;
    const tableEl = tableScrollRef.current;
    if (!leftEl || !tableEl) return;
    if (from === 'left') tableEl.scrollTop = leftEl.scrollTop;
    else leftEl.scrollTop = tableEl.scrollTop;
  };

  const headerColumns = React.useMemo(() => {
    const base = [
      { id: 'mdl_work', label: 'MDL Work', minWidth: 80 },
      { id: 'mdl_appr', label: 'MDL Appr', minWidth: 80 },
      { id: 'mdl_submitted', label: 'MDL Submitted At', minWidth: 110 },
      { id: 'rig_work', label: 'RIG Work', minWidth: 80 },
      { id: 'rig_appr', label: 'RIG Appr', minWidth: 80 },
      { id: 'rig_submitted', label: 'RIG Submitted At', minWidth: 110 },
      { id: 'bld_work', label: 'BLD Work', minWidth: 80 },
      { id: 'bld_appr', label: 'BLD Appr', minWidth: 80 },
      { id: 'bld_submitted', label: 'BLD Submitted At', minWidth: 110 },
      { id: 'dsn_work', label: 'DSN Work', minWidth: 80 },
      { id: 'dsn_appr', label: 'DSN Appr', minWidth: 80 },
      { id: 'dsn_submitted', label: 'DSN Submitted At', minWidth: 110 },
      { id: 'ldv_work', label: 'LDV Work', minWidth: 80 },
      { id: 'ldv_appr', label: 'LDV Appr', minWidth: 80 },
      { id: 'ldv_submitted', label: 'LDV Submitted At', minWidth: 110 },
      { id: 'relation', label: 'Relation', minWidth: 90 },
    ];
    return base;
  }, []);

  return (
    <Root maxWidth={false}>
      <Box>
        <Toolbar>
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <IconButton onClick={() => setBarView('list')}><ViewListIcon style={{ fontSize: 18, color: barView === 'list' ? '#00b7ff' : '#b0b0b0' }} /></IconButton>
            <IconButton onClick={() => setBarView('group')}><ViewModuleIcon style={{ fontSize: 18, color: barView === 'group' ? '#00b7ff' : '#b0b0b0' }} /></IconButton>
            {barView === 'group' && <IconButton onClick={() => setLeftOpen(!leftOpen)}><MenuIcon style={{ fontSize: 18, color: '#fff' }} /></IconButton>}
            <Typography variant="subtitle2" style={{ color: '#fff' }}>Assets Row Table</Typography>
          </Box>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Assets..."
            variant="outlined"
            InputProps={{ style: { height: 30, color: '#fff', fontSize: 12, backgroundColor: '#444' } }}
            style={{ width: 220 }}
          />
        </Toolbar>

        <ContentRow>
          {barView === 'group' && leftOpen && (
            <LeftPanel>
              <LeftPanelBody ref={leftScrollRef} onScroll={() => syncScroll('left')}>
                <List dense disablePadding>
                  {MOCK_GROUPS.map((g) => (
                    <React.Fragment key={g.id}>
                      <ListItem button onClick={() => {
                        const next = {...openGroups};
                        next[g.id] = !openGroups[g.id];
                        setOpenGroups(next);
                      }} style={{ height: GROUP_ROW_H }}>
                        <ListItemText primary={g.label + " (" + g.count + ")"} primaryTypographyProps={{ style: { fontSize: 12, color: '#fff', fontWeight: 600 } }} />
                        {openGroups[g.id] ? <ExpandLessIcon style={{ color: '#666' }} /> : <ExpandMoreIcon style={{ color: '#666' }} />}
                      </ListItem>
                      <Collapse in={openGroups[g.id]}>
                        {g.assets.map((a) => (
                          <ListItem key={a.id} button style={{ paddingLeft: 24, height: ASSET_ROW_H }}>
                            <Box display="flex" alignItems="center" gap={1.5}>
                              <Box width={32} height={24} bgcolor="rgba(255,255,255,0.1)" borderRadius={1} />
                              <Typography style={{ color: '#ddd', fontSize: 12 }}>{a.name}</Typography>
                            </Box>
                          </ListItem>
                        ))}
                      </Collapse>
                    </React.Fragment>
                  ))}
                </List>
              </LeftPanelBody>
            </LeftPanel>
          )}

          <TableShell>
            <TableScroller ref={tableScrollRef} onScroll={() => syncScroll('table')}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {activeCols.map((c) => (
                      <HeaderCell key={c.id} style={{ minWidth: c.minWidth }}>{c.label}</HeaderCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {MOCK_GROUPS.map((group) => (
                    <React.Fragment key={group.id}>
                      <TableRow style={{ backgroundColor: '#1e1e1e' }}>
                        <TableCell colSpan={activeCols.length} style={{ borderBottom: 'none', paddingTop: 16 }}>
                          <GroupTitleLabel>{group.label}</GroupTitleLabel>
                        </TableCell>
                      </TableRow>
                      
                      {(barView === 'list' || openGroups[group.id]) && group.assets.map((asset) => (
                        <TableRow key={asset.id} hover style={{ height: ASSET_ROW_H }}>
                          {activeCols.map((col) => {
                            const val = (asset as any)[col.id];
                            
                            // Standard syntax find to avoid optional chaining error
                            const dept = DEPT_GROUPS.find(function(d) { 
                              return d.cols.indexOf(col.id) !== -1; 
                            });

                            const isFirst = dept && dept.cols[0] === col.id;
                            const isLast = dept && dept.cols[dept.cols.length - 1] === col.id;

                            return (
                              <GroupedDataCell 
                                key={col.id} 
                                borderColor={dept ? dept.color : undefined} 
                                isFirstInDept={!!isFirst} 
                                isLastInDept={!!isLast}
                                statusColor={getStatusColor(val)}
                              >
                                {val || '—'}
                              </GroupedDataCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </React.Fragment>
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

// --- Mock Data ---
const generateMockData = (id: string, name: string) => ({
  id: id, name: name,
  mdl_work: 'Done', mdl_appr: 'Approved', mdl_submitted: '2023-11-20',
  rig_work: 'In Progress', rig_appr: '—', rig_submitted: '—',
  bld_work: 'Waiting', bld_appr: '—', bld_submitted: '—',
  dsn_work: 'Done', dsn_appr: 'Approved', dsn_submitted: '2023-10-15',
  relation: 'Master',
});

const MOCK_GROUPS = [
  { id: 'camera', label: 'camera', count: 3, assets: [generateMockData('c1', 'camAim'), generateMockData('c2', 'camHero'), generateMockData('c3', 'camWide')] },
  { id: 'character', label: 'character', count: 4, assets: [generateMockData('ch1', 'ando'), generateMockData('ch2', 'baseFemale'), generateMockData('ch3', 'baseMale'), generateMockData('ch4', 'chris')] },
];

export default AssetsRowTablePanel;
