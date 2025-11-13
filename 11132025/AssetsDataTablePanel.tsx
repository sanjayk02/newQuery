import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { Button, Container, Paper, styled } from '@material-ui/core';

import { useFetchAssetsPivot } from './hooks';
import { FilterProps as _FilterProps, PageProps, SortDir } from './types';
import AssetsDataTable from './AssetsDataTable';
import AssetTableFilter from './AssetDataTableFilter';
import AssetsDataTableFooter from './AssetsDataTableFooter';

import { useCurrentProject } from '../hooks';
import { useCurrentStudio } from '../../studio/hooks';
import { queryConfig } from '../../new-pipeline-setting/api';

/* ──────────────────────────────────────────────────────────────────────────
 * Styling
 * ────────────────────────────────────────────────────────────────────────── */
const StyledContainer = styled(Container)(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  padding: 10,
  overflowX: 'auto',
  '& > *': { display: 'flex', overflow: 'visible', padding: theme.spacing(1), paddingBottom: 0 },
  '& > *:last-child': { paddingBottom: theme.spacing(1) },
}));
const StyledPaper = styled(Paper)({ width: '100%', display: 'flex', flexDirection: 'column', overflow: 'visible' });
const StyledContentDiv = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper, display: 'flex', flexDirection: 'column', width: '100%', overflow: 'visible',
}));
const StyledTableDiv = styled('div')({ paddingBottom: 8 });

/* ──────────────────────────────────────────────────────────────────────────
 * Initial state
 * ────────────────────────────────────────────────────────────────────────── */
const initPageProps: PageProps = { page: 0, rowsPerPage: 15 };
const initFilterProps: _FilterProps = {
  assetNameKey: '',
  approvalStatuses: [],
  workStatuses: [],
  selectPhasePriority: '',
  selectApprovalStatus: '',
  selectWorkStatus: '',
  onPhasePriorityChange: undefined,
  onApprovalStatusChange: undefined,
  onWorkStatusChange: undefined,
};

/* Column metadata (ids must match table columns) */
const COLUMN_META: { id: string; label: string }[] = [
  { id: 'thumbnail', label: 'Thumbnail' },
  { id: 'group_1_name', label: 'Name' },
  { id: 'mdl_work_status', label: 'MDL WORK' },
  { id: 'mdl_approval_status', label: 'MDL APPR' },
  { id: 'mdl_submitted_at', label: 'MDL Submitted At' },
  { id: 'rig_work_status', label: 'RIG WORK' },
  { id: 'rig_approval_status', label: 'RIG APPR' },
  { id: 'rig_submitted_at', label: 'RIG Submitted At' },
  { id: 'bld_work_status', label: 'BLD WORK' },
  { id: 'bld_approval_status', label: 'BLD APPR' },
  { id: 'bld_submitted_at', label: 'BLD Submitted At' },
  { id: 'dsn_work_status', label: 'DSN WORK' },
  { id: 'dsn_approval_status', label: 'DSN APPR' },
  { id: 'dsn_submitted_at', label: 'DSN Submitted At' },
  { id: 'ldv_work_status', label: 'LDV WORK' },
  { id: 'ldv_approval_status', label: 'LDV APPR' },
  { id: 'ldv_submitted_at', label: 'LDV Submitted At' },
  { id: 'relation', label: 'Relation' },
];

// Always-visible columns
const FIXED_VISIBLE = new Set<string>(['thumbnail', 'group_1_name']);
const PIPE_KEY = '/ppiTracker/assets/hideColumns';
const lsKeyForProject = (projectKeyName?: string) => `ppi:assets:hideColumns:${projectKeyName || 'unknown'}`;

const AssetsDataTablePanel: FC<RouteComponentProps> = () => {
  const [pageProps, setPageProps] = useState<PageProps>(initPageProps);
  const [filterProps, setFilterProps] = useState<_FilterProps>(initFilterProps);

  // Server-side sorting (drives fetch)
  const [sortKey, setSortKey] = useState<string>('group_1');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [phasePriority, setPhasePriority] = useState<string>('none'); // mdl|rig|bld|dsn|ldv|none

  // UI sort (instant arrow feedback)
  const [uiSortKey, setUiSortKey] = useState<string>('group_1');
  const [uiSortDir, setUiSortDir] = useState<SortDir>('asc');

  // Column visibility
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  const { currentProject } = useCurrentProject();
  const { currentStudio } = useCurrentStudio();
  const [timeZone, setTimeZone] = useState<string | undefined>();

  /* Save + load hidden columns (pipeline setting -> localStorage fallback) */
  const persistHiddenColumnsLocal = (next: Set<string>) => {
    const key = lsKeyForProject(currentProject && (currentProject as any).key_name ? (currentProject as any).key_name : undefined);
    try { localStorage.setItem(key, JSON.stringify(Array.from(next))); } catch {}
  };
  const saveHiddenColumnsToPipelineSetting = async (cols: Set<string>) => {
    try {
      if (!currentProject || !(currentProject as any).key_name) return;
      await (queryConfig as any)(
        'project',
        (currentProject as any).key_name,
        PIPE_KEY,
        JSON.stringify(Array.from(cols))
      );
    } catch {}
  };

  /* Load saved hidden columns (pref: pipeline setting) */
  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!currentProject) return;
      try {
        const val = await queryConfig('project', (currentProject as any).key_name, PIPE_KEY);
        if (aborted) return;
        let arr: string[] | null = null;
        if (Array.isArray(val)) arr = val as string[];
        else if (typeof val === 'string' && val.trim() !== '') {
          try { arr = JSON.parse(val); } catch { arr = val.split(',').map((s: string) => s.trim()); }
        }
        if (!arr) {
          const raw = localStorage.getItem(lsKeyForProject((currentProject as any).key_name));
          if (raw) { try { arr = JSON.parse(raw); } catch { arr = []; } }
        }
        setHiddenColumns(new Set(arr ?? []));
      } catch {
        const raw = localStorage.getItem(lsKeyForProject((currentProject as any).key_name));
        if (raw) { try { setHiddenColumns(new Set(JSON.parse(raw))); } catch {} }
      }
    })();
    return () => { aborted = true; };
  }, [currentProject]);

  /* Always unhide ALL phases' WORK + Submitted At columns */
  useEffect(() => {
    const mustShow = [
      'mdl_work_status', 'mdl_submitted_at',
      'rig_work_status', 'rig_submitted_at',
      'bld_work_status', 'bld_submitted_at',
      'dsn_work_status', 'dsn_submitted_at',
      'ldv_work_status', 'ldv_submitted_at',
    ];
    setHiddenColumns(prev => {
      const next = new Set(prev);
      let changed = false;
      mustShow.forEach(id => { if (next.delete(id)) changed = true; });
      if (changed) persistHiddenColumnsLocal(next);
      return next;
    });
  }, [currentProject]);

  /* Decide which phase to enforce on the backend for approval filtering */
  const effectivePhase = useMemo(() => {
    if (phasePriority && phasePriority !== 'none') return phasePriority;
    if (filterProps.approvalStatuses && filterProps.approvalStatuses.length > 0) return 'bld';
    return 'none';
  }, [phasePriority, filterProps.approvalStatuses]);

  /* Fetch data with phase guard applied */
  const { assets, total } = useFetchAssetsPivot(
    currentProject,
    pageProps.page,
    pageProps.rowsPerPage,
    sortKey,
    sortDir,
    effectivePhase,                 // <— phase guard activates in backend
    filterProps.assetNameKey,
    filterProps.approvalStatuses,
    filterProps.workStatuses,
  );

  /* Toggle column visibility */
  const handleToggleColumn = (id: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      persistHiddenColumnsLocal(next);
      return next;
    });
  };

  /* Filter handlers */
  const onAssetNameChange: React.ChangeEventHandler<HTMLInputElement> = (e) =>
    setFilterProps(p => ({ ...p, assetNameKey: e.target.value }));

  const onApprovalStatusesChange: SelectProps['onChange'] = (e) =>
    setFilterProps(p => ({ ...p, approvalStatuses: (e.target.value as string[]) ?? [] }));

  const onWorkStatusesChange: SelectProps['onChange'] = (e) =>
    setFilterProps(p => ({ ...p, workStatuses: (e.target.value as string[]) ?? [] }));

  const onApprovalStatusChipDelete: ChipDeleteFunction = (value) =>
    setFilterProps(p => ({ ...p, approvalStatuses: (p.approvalStatuses || []).filter(v => v !== value) }));

  const onWorkStatusChipDelete: ChipDeleteFunction = (value) =>
    setFilterProps(p => ({ ...p, workStatuses: (p.workStatuses || []).filter(v => v !== value) }));

  const onResetClick: React.MouseEventHandler<HTMLButtonElement> = () => {
    setFilterProps(initFilterProps);
    setPhasePriority('none');
  };

  /* Sorting */
  const handleSortChange = (nextKey: string) => {
    const same = uiSortKey === nextKey;
    const nextDir: SortDir = same ? (uiSortDir === 'asc' ? 'desc' : 'asc') : 'asc';
    setUiSortKey(nextKey);
    setUiSortDir(nextDir);
    setSortKey(nextKey);
    setSortDir(nextDir);
  };

  /* Drawer state */
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* Pagination */
  const handleChangePage = (_: any, newPage: number) => setPageProps(p => ({ ...p, page: newPage }));
  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    setPageProps({ page: 0, rowsPerPage: v });
  };

  return (
    <StyledContainer>
      <StyledPaper>
        <StyledContentDiv>
          <AssetTableFilter
            filterAssetName={filterProps.assetNameKey}
            selectApprovalStatuses={filterProps.approvalStatuses || []}
            selectWorkStatuses={filterProps.workStatuses || []}
            onAssetNameChange={onAssetNameChange}
            onApprovalStatusesChange={onApprovalStatusesChange}
            onWorkStatusesChange={onWorkStatusesChange}
            onApprovalStatusChipDelete={onApprovalStatusChipDelete}
            onWorkStatusChipDelete={onWorkStatusChipDelete}
            onResetClick={onResetClick}
            hiddenColumns={hiddenColumns}
            onToggleColumn={handleToggleColumn}
            drawerOpen={drawerOpen}
            setDrawerOpen={setDrawerOpen}
          />

          <StyledTableDiv>
            <AssetsDataTable
              assets={assets}
              hiddenColumns={hiddenColumns}
              currentSortKey={uiSortKey}
              currentSortDir={uiSortDir}
              onSortChange={handleSortChange}
              assetNameKey={filterProps.assetNameKey}
              approvalStatuses={filterProps.approvalStatuses || []}
              workStatuses={filterProps.workStatuses || []}
            />
          </StyledTableDiv>

          <AssetsDataTableFooter
            count={total || 0}
            page={pageProps.page}
            rowsPerPage={pageProps.rowsPerPage}
            onChangePage={handleChangePage}
            onChangeRowsPerPage={handleChangeRowsPerPage}
          />
        </StyledContentDiv>
      </StyledPaper>
    </StyledContainer>
  );
};

export default AssetsDataTablePanel;
