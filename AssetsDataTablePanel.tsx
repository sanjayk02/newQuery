import React, { FC, useEffect, useRef, useState } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import {
  Button,
  Checkbox,
  Container,
  Divider,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  styled,
} from '@material-ui/core';
import { ButtonProps } from '@material-ui/core/Button';
import { SelectProps } from '@material-ui/core/Select';
import { TablePaginationProps } from '@material-ui/core/TablePagination';
import { TextFieldProps } from '@material-ui/core/TextField';

import { useFetchAssetsPivot } from './hooks';
import { FilterProps, PageProps, SortDir } from './types';
import AssetsDataTable from './AssetsDataTable';
import AssetTableFilter from './AssetDataTableFilter';
import AssetsDataTableFooter from './AssetsDataTableFooter';

import { useCurrentProject } from '../hooks';
import { useCurrentStudio } from '../../studio/hooks';
import { queryConfig, updateConfig } from '../../new-pipeline-setting/api';

/** ──────────────────────────────────────────────────────────────────────────
 *  Local copy of table columns for the Column Visibility menu
 *  (keeps this file self-contained; ids must match AssetsDataTable.tsx)
 *  ────────────────────────────────────────────────────────────────────────── */
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

// Columns that are always visible (enforced both in UI and render):
const FIXED_VISIBLE = new Set<string>(['thumbnail', 'group_1_name']);

/** ──────────────────────────────────────────────────────────────────────────
 *  Component
 *  ────────────────────────────────────────────────────────────────────────── */

const StyledContainer = styled(Container)(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  padding: 10,
  '& > *': {
    display: 'flex',
    overflow: 'hidden',
    padding: theme.spacing(1),
    paddingBottom: 0,
  },
  '& > *:last-child': {
    paddingBottom: theme.spacing(1),
  },
}));

const StyledPaper = styled(Paper)({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'auto',
});

const StyledContentDiv = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  display: 'flex',
  flexDirection: 'row',
}));

const StyledTableDiv = styled('div')({
  paddingBottom: 8,
});

const initPageProps: PageProps = { page: 0, rowsPerPage: 15 };
const initFilterProps: FilterProps = {
  assetNameKey: '',
  applovalStatues: [],
  workStatues: [],
  selectPhasePriority: '',
  selectApprovalStatus: '',
  selectWorkStatus: '',
  onPhasePriorityChange: undefined,
  onApprovalStatusChange: undefined,
  onWorkStatusChange: undefined,
};

const AssetsDataTablePanel: FC<RouteComponentProps> = () => {
  const [pageProps, setPageProps] = useState<PageProps>(initPageProps);
  const [filterProps, setFilterProps] = useState<FilterProps>(initFilterProps);

  // Server-side sorting + phase (drives fetch)
  const [sortKey, setSortKey] = useState<string>('group_1');   // server sort key
  const [sortDir, setSortDir] = useState<SortDir>('asc');      // 'asc' | 'desc'
  const [phasePriority, setPhasePriority] = useState<string>('none'); // mdl|rig|bld|dsn|ldv|none

  // UI-only (instant header arrows; debounced commit to server state)
  const [uiSortKey, setUiSortKey] = useState<string>('group_1');
  const [uiSortDir, setUiSortDir] = useState<SortDir>('asc');

  // Debounce timer
  const commitTimerRef = useRef<number | null>(null);

  // Column visibility state + menu
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [colAnchorEl, setColAnchorEl] = useState<null | HTMLElement>(null);

  const { currentProject } = useCurrentProject();
  const { currentStudio } = useCurrentStudio();
  const [timeZone, setTimeZone] = useState<string | undefined>();

  /** ────────────────────────────────────────────────────────────────────────
   *  Helpers
   *  ──────────────────────────────────────────────────────────────────────── */
  // Accepts 'group_1', 'relation', and '<phase>_(work|appr|submitted)'
  const resolveServerSort = (key: string): { sort: string; phase: string } => {
    if (key === 'group_1') return { sort: 'group_1', phase: 'none' };
    if (key === 'relation') return { sort: 'relation', phase: 'none' };

    const m = key.match(/^(mdl|rig|bld|dsn|ldv)_(work|appr|submitted)$/i);
    if (!m) return { sort: 'group_1', phase: 'none' };

    const phase = m[1].toLowerCase();
    const field = m[2].toLowerCase();

    if (field === 'submitted') return { sort: 'submitted_at_utc', phase };
    // Until backend exposes approval-only ordering, map work/appr to work_status
    return { sort: 'work_status', phase };
  };

  // Persist hidden columns to project config
  const persistHiddenColumns = async (next: Set<string>) => {
    if (!currentProject) return;
    try {
      await updateConfig(
        'project',
        currentProject.key_name,
        '/ppiTracker/assets/hideColumns',
        Array.from(next)
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Save hideColumns failed', e);
    }
  };

  /** ────────────────────────────────────────────────────────────────────────
   *  Data fetch
   *  ──────────────────────────────────────────────────────────────────────── */
  const { assets, total } = useFetchAssetsPivot(
    currentProject,
    pageProps.page,
    pageProps.rowsPerPage,
    sortKey,
    sortDir,
    phasePriority,
  );

  /** ────────────────────────────────────────────────────────────────────────
   *  Effects
   *  ──────────────────────────────────────────────────────────────────────── */
  // Studio timezone
  useEffect(() => {
    if (currentStudio == null) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res: string | null = await queryConfig(
          'studio',
          currentStudio.key_name,
          'timezone'
        ).catch((e: any) => {
          if (e && e.name === 'AbortError') return null;
          throw e;
        });
        if (res != null) setTimeZone(res);
      } catch (e) {
        console.error(e);
        setTimeZone(undefined);
      }
    })();
    return () => controller.abort();
  }, [currentStudio]);

 // Load hidden columns from PipelineSetting when project changes
  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!currentProject) return;
      try {
        const key = '/ppiTracker/assets/hideColumns';
        const val = await queryConfig('project', currentProject.key_name, key);

        if (aborted) return;

        let arr: string[] = [];
        if (Array.isArray(val)) {
          arr = val as string[];
        } else if (typeof val === 'string' && val.trim() !== '') {
          try {
            arr = JSON.parse(val);
          } catch {
            arr = val.split(',').map((s) => s.trim());
          }
        }
        // Enforce fixed visible columns
        const sanitized = arr.filter((id) => !FIXED_VISIBLE.has(id));
        setHiddenColumns(new Set(sanitized));
      } catch (e) {
        console.error('Load hideColumns failed', e);
        setHiddenColumns(new Set());
      }
    })();
    return () => {
      aborted = true;
    };
  }, [currentProject]);

  // Cleanup pending debounce on unmount
  useEffect(() => {
    return () => {
      if (commitTimerRef.current != null) {
        window.clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
    };
  }, []);

  /** ────────────────────────────────────────────────────────────────────────
   *  Pagination
   *  ──────────────────────────────────────────────────────────────────────── */
  const handleRowsPerPageChange: TablePaginationProps['onChangeRowsPerPage'] = event => {
    setPageProps({ page: 0, rowsPerPage: parseInt(event.target.value, 10) });
  };
  const handlePageChange: TablePaginationProps['onChangePage'] = (_event, newPage) => {
    setPageProps(p => ({ ...p, page: newPage }));
  };

/** ────────────────────────────────────────────────────────────────────────
   *  Sorting (2s debounced commit to server; instant UI update after commit)
   *  ──────────────────────────────────────────────────────────────────────── */
  const handleSortChange = (newUiKey: string) => {
    const { sort, phase } = resolveServerSort(newUiKey);

    // Compute next SERVER dir
    const nextServerDir: SortDir =
      sortKey === sort ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';

    // Clear pending debounce
    if (commitTimerRef.current != null) {
      window.clearTimeout(commitTimerRef.current);
    }

    // Debounce BOTH: server + UI arrow
    commitTimerRef.current = window.setTimeout(() => {
      setPhasePriority(phase);
      setSortKey(sort);
      setSortDir(nextServerDir);

      // UI updates AFTER fetch is triggered
      setUiSortKey(newUiKey);
      setUiSortDir(nextServerDir);

      commitTimerRef.current = null;
    }, 5000);
  };


  /** ────────────────────────────────────────────────────────────────────────
   *  Filters
   *  ──────────────────────────────────────────────────────────────────────── */
  const handleFilterAssetNameChange: TextFieldProps['onChange'] = (event) => {
    setFilterProps((p) => ({ ...p, assetNameKey: event.target.value }));
    setPageProps((p) => ({ ...p, page: 0 }));
  };
  const handleApprovalStatusesChange: SelectProps['onChange'] = (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    setFilterProps((p) => ({
      ...p,
      applovalStatues: event.target.value as string[],
    }));
    setPageProps((p) => ({ ...p, page: 0 }));
  };
  const handleWorkStatusesChange: SelectProps['onChange'] = (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    setFilterProps((p) => ({
      ...p,
      workStatues: event.target.value as string[],
    }));
    setPageProps((p) => ({ ...p, page: 0 }));
  };
  const handleApprovalStatusesChipDelete = (name: string) => {
    setFilterProps((p) => ({
      ...p,
      applovalStatues: p.applovalStatues.filter((v) => v !== name),
    }));
    setPageProps((p) => ({ ...p, page: 0 }));
  };
  const handleWorkStatusesChipDelete = (name: string) => {
    setFilterProps((p) => ({
      ...p,
      workStatues: p.workStatues.filter((v) => v !== name),
    }));
    setPageProps((p) => ({ ...p, page: 0 }));
  };
  const handleFilterResetClick: ButtonProps['onClick'] = () =>
    setFilterProps(initFilterProps);

  /** ────────────────────────────────────────────────────────────────────────
   *  Column Visibility menu
   *  ──────────────────────────────────────────────────────────────────────── */
  const openColumnMenu = (e: React.MouseEvent<HTMLButtonElement>) =>
    setColAnchorEl(e.currentTarget);
  const closeColumnMenu = () => setColAnchorEl(null);

  const toggleColumn = (id: string) => {
    if ( FIXED_VISIBLE.has(id) ) return; // fixed
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // persist in background
      void persistHiddenColumns(next);
      return next;
    });
  };

  const showAll = () => {
    const next = new Set<string>(); // nothing hidden
    setHiddenColumns(next);
    void persistHiddenColumns(next);
  };

  const hideAllNonFixed = () => {
    const next = new Set<string>(
      COLUMN_META.map((c) => c.id).filter((id) => !FIXED_VISIBLE.has(id))
    );
    setHiddenColumns(next);
    void persistHiddenColumns(next);
  };

  /** ────────────────────────────────────────────────────────────────────────
   *  Date/Time format
   *  ──────────────────────────────────────────────────────────────────────── */
  const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  /** ────────────────────────────────────────────────────────────────────────
   *  Footer (pagination)
   *  ──────────────────────────────────────────────────────────────────────── */
  const tableFooter = (
    <AssetsDataTableFooter
      count={total}
      page={pageProps.page}
      rowsPerPage={pageProps.rowsPerPage}
      onChangePage={handlePageChange}
      onChangeRowsPerPage={handleRowsPerPageChange}
    />
  );

  /** ────────────────────────────────────────────────────────────────────────
   *  Render
   *  ──────────────────────────────────────────────────────────────────────── */
  return (
    <StyledContainer maxWidth="xl">
      {/* Filters */}
      <AssetTableFilter
        filterAssetName={filterProps.assetNameKey}
        selectApprovalStatuses={filterProps.applovalStatues}
        selectWorkStatuses={filterProps.workStatues}
        onAssetNameChange={handleFilterAssetNameChange}
        onApprovalStatusesChange={handleApprovalStatusesChange}
        onWorkStatusesChange={handleWorkStatusesChange}
        onApprovalStatusChipDelete={handleApprovalStatusesChipDelete}
        onWorkStatusChipDelete={handleWorkStatusesChipDelete}
        onResetClick={handleFilterResetClick}
      />

      {/* Column Visibility button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px' }}>
        <Button variant="outlined" onClick={openColumnMenu}>Columns</Button>
        <Menu
          anchorEl={colAnchorEl}
          open={Boolean(colAnchorEl)}
          onClose={closeColumnMenu}
          keepMounted
        >
          <MenuItem disabled style={{ opacity: 0.7 }}>
            <ListItemText primary="Show / Hide Columns" />
          </MenuItem>
          <Divider />
          {COLUMN_META.map((col) => {
            const forcedVisible = FIXED_VISIBLE.has(col.id);
            const checked =
              forcedVisible || !hiddenColumns.has(col.id);
            return (
              <MenuItem
                key={col.id}
                disabled={forcedVisible}
                onClick={() => toggleColumn(col.id)}
              >
                <Checkbox
                  edge="start"
                  checked={checked}
                  tabIndex={-1}
                  disableRipple
                />
                <ListItemText primary={col.label} />
              </MenuItem>
            );
          })}
          <Divider />
          <MenuItem onClick={showAll}><ListItemText primary="Show All" /></MenuItem>
          <MenuItem onClick={hideAllNonFixed}><ListItemText primary="Hide All (except Thumbnail/Name)" /></MenuItem>
        </Menu>
      </div>

      {/* Table */}
      <StyledTableDiv>
        <StyledPaper>
          <StyledContentDiv>
            <AssetsDataTable
              project={currentProject}
              assets={assets}
              tableFooter={tableFooter}
              dateTimeFormat={dateTimeFormat}
              onSortChange={handleSortChange}
              currentSortKey={uiSortKey}
              currentSortDir={uiSortDir}
              // Pass the hidden columns down (table renders conditionally)
              hiddenColumns={hiddenColumns}
            />
          </StyledContentDiv>
        </StyledPaper>
      </StyledTableDiv>
    </StyledContainer>
  );
};

export default AssetsDataTablePanel;