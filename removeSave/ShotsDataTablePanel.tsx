import React, {
    FC,
    useCallback,
    useEffect,
    useState,
    useRef,
    useMemo,
} from 'react';
import { RouteComponentProps } from "react-router-dom";
import { CircularProgress, Container, Paper, styled } from '@material-ui/core';
import { TablePaginationProps } from '@material-ui/core/TablePagination';
import { useFetchPipelineSettingShotComponents, useFetchShotCamDataTypes, useReviewShotsPivot} from './hooks';
import { PageProps, ShotPivot } from './types';
import ShotsDataTable from './ShotsDataTable';
import ShotsDataTableFooter from './ShotsDataTableFooter';
import { useCurrentProject } from '../../hooks';
import { useCurrentStudio } from '../../../studio/hooks';
import { queryConfig } from '../../../new-pipeline-setting/api';
import ShotDataTableToolbar, {
    ViewMode,
    buildDefaultColumnState,
} from './ShotDataTableToolbar';
import { fetchGenerateShotCsv } from './api';
import DownloadFab from '../DownloadFab';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import Button from '@material-ui/core/Button';
import ShotsDataTableGroup, { getShotSortValue } from './ShotsDataTableGroup';
import { Project } from '../../types';


/* ── Styled Components ─────────────────────────────────────────────────── */
const StyledContainer = styled(Container)(({ theme }) => ({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    padding: 0,
    overflow: 'hidden',  // Hide overflow on container level
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
    gap: theme.spacing(2),
    width: 'fit-content',
    minWidth: '80%',
    height: '100%',
}));

const StyledTableDiv = styled('div')({
    paddingBottom: 8,
    overflowX: 'auto',
    width: '100%',
    height: '100%',
});

const ToolBarWrapper = styled('div')(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
}));

const FooterWrapper = styled('div')(({ theme }) => ({
    display:         'flex',
    justifyContent:  'flex-end',
    width:           '100%',
    backgroundColor: theme.palette.background.paper,
    paddingRight:  theme.spacing(25),
}));

/* ── Types ─────────────────────────────────────────────────────────────── */

type Filters = {
    shotGroups:     string[];
    approvalStatus: string[];
    workStatus:     string[];
};


const CsvDownloadComponent = ({ currentProject }: { currentProject: Project | null | undefined }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [errorDialogOpen, setErrorDialogOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleErrorDialogClose = () => {
        setErrorDialogOpen(false);
    };

    const handleFetchGenerateAssetCsv = useCallback(async () => {
        if (currentProject == null) {
            console.warn('Project not selected.');
            return;
        }

        setIsLoading(true);
        setErrorMessage('');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60 * 5000);

        try {
            const res = await fetchGenerateShotCsv(
                currentProject.key_name,
                controller.signal,
            );

            if (res != null) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', 'shot_data.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Failed to download CSV:', err);
            setErrorMessage('Failed to download CSV');
            setErrorDialogOpen(true);
        } finally {
            clearTimeout(timeoutId);
            setIsLoading(false);
        }
    }, [currentProject]);

    return (
        <div>
            <DownloadFab
                onClick={handleFetchGenerateAssetCsv}
                disabled={isLoading}
            />
            <Dialog
                open={errorDialogOpen}
                onClose={handleErrorDialogClose}
                aria-labelledby="error-dialog-title"
            >
                <DialogTitle id="error-dialog-title">CSV Download Error</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {errorMessage}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleErrorDialogClose} color="primary" autoFocus>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};


/* ── Main Component ─────────────────────────────────────────────────────── */

const ShotsDataTablePanel: FC<RouteComponentProps> = () => {
    const [viewMode,     setViewMode]     = useState<ViewMode>('list');
    const [searchValue,  setSearchValue]  = useState<string>('');
    const [filters,      setFilters]      = useState<Filters>({
        shotGroups:     [],
        approvalStatus: [],
        workStatus:     [],
    });
    const [pageProps, setPageProps] = useState<PageProps>({
        page:        0,
        rowsPerPage: 15,
    });

    // Helper function for localStorage key
    const lsKeyForProject = (projectKeyName?: string) => {
    return `ppi:shots:hiddenColumns:${projectKeyName || 'unknown'}`;
    };


    const [sortKey, setSortKey] = useState<string>('group1_only');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [groupSortDir, setGroupSortDir] = useState<'asc' | 'desc'>('asc');
    const [selectedCellIds, setSelectedCellIds] = useState<Set<string>>(new Set());

    // Toggle a single cell's selection on/off.
    const handleCellSelect = (cellId: string) => {
        setSelectedCellIds(prev => {
            const next = new Set(prev);
            if (next.has(cellId)) next.delete(cellId);
            else                  next.add(cellId);
            return next;
        });
    };

    const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

    // Toggle row highlight: clicking the same row again clears it.
    const handleRowSelect = (rowId: string | null) => {
        setSelectedRowId(prev => (prev === rowId ? null : rowId));
    };

    const { currentProject } = useCurrentProject();
    const { phaseComponents } = useFetchPipelineSettingShotComponents(currentProject);

    // reset page when search or filters change
    const prevSearchRef   = useRef(searchValue);
    const prevApprovalRef = useRef(JSON.stringify(filters.approvalStatus));
    const prevWorkRef     = useRef(JSON.stringify(filters.workStatus));

    const searchOrFilterChanged =
        prevSearchRef.current   !== searchValue ||
        prevApprovalRef.current !== JSON.stringify(filters.approvalStatus) ||
        prevWorkRef.current     !== JSON.stringify(filters.workStatus);

    const effectivePage = searchOrFilterChanged ? 0 : pageProps.page;

    useEffect(() => {
        if (searchOrFilterChanged) {
            prevSearchRef.current   = searchValue;
            prevApprovalRef.current = JSON.stringify(filters.approvalStatus);
            prevWorkRef.current     = JSON.stringify(filters.workStatus);
            setPageProps(prev => ({ ...prev, page: 0 }));
        }
    }, [
        searchValue,
        JSON.stringify(filters.approvalStatus),
        JSON.stringify(filters.workStatus),
        JSON.stringify(filters.shotGroups),
    ]);

    const isGroupView    = viewMode === 'group';
    const backendPage    = isGroupView ? 1 : effectivePage + 1;  // API is 1-based
    const backendPerPage = isGroupView ? 10000 : pageProps.rowsPerPage;


    // Old useShotsPivot
    const { shots, total, groupCounts, loading } = useReviewShotsPivot({
        project:        currentProject,
        page:           backendPage,
        perPage:        backendPerPage,
        nameKey:        searchValue,
        approvalStatus: filters.approvalStatus,
        workStatus:     filters.workStatus,
        orderKey:       isGroupView ? 'group1_only' : sortKey,
        direction:      isGroupView ? 'ASC' : sortDir.toUpperCase(),
        shotsGroups:    filters.shotGroups,
    });

    // ─── NEW: fetch cam_data_type for the current page's shots ───
    const { camDataTypes } = useFetchShotCamDataTypes(currentProject, shots);

    // Print to console whenever data arrives
    useEffect(() => {
        if (Object.keys(camDataTypes).length === 0) {
            // console.log('[CamDataType] Panel: no cam_data_type data yet');
            return;
        }
    }, [camDataTypes]);

    /* ── Sort ALL shots into canonical hierarchical order ────────────── */
    const sortedAllShots = useMemo(() => {
        if (!isGroupView || !shots || shots.length === 0) return shots || [];
        if (shots.length < total) return [];

        const smartCmp = (a: string, b: string, dir: 'asc' | 'desc' = 'asc') => {
            const isNumA = /^\d+$/.test(a);
            const isNumB = /^\d+$/.test(b);
            let cmp: number;
            if (isNumA && isNumB) {
                cmp = parseInt(a, 10) - parseInt(b, 10);
            } else if (isNumA) {
                cmp = -1;
            } else if (isNumB) {
                cmp = 1;
            } else {
                cmp = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
            }
            return dir === 'asc' ? cmp : -cmp;
        };

        const group2Dir: 'asc' | 'desc' =
            sortKey === 'group2_only' && sortDir === 'desc' ? 'desc' : 'asc';

        const arr = [...shots];
        arr.sort((a, b) => {
            // 1. NAME 1 — direction from groupSortDir
            const g1cmp = a.group_1.toLowerCase().localeCompare(b.group_1.toLowerCase());
            const g1 = groupSortDir === 'asc' ? g1cmp : -g1cmp;
            if (g1 !== 0) return g1;

            // 2. NAME 2 — smart sort, direction from sortKey/sortDir
            const g2 = smartCmp(a.group_2, b.group_2, group2Dir);
            if (g2 !== 0) return g2;

            // 3. NAME 3 (or phase column) by sortDir
            const aVal = getShotSortValue(a, sortKey);
            const bVal = getShotSortValue(b, sortKey);

            const aEmpty = aVal === null || aVal === undefined || aVal === '' || aVal === 0;
            const bEmpty = bVal === null || bVal === undefined || bVal === '' || bVal === 0;
            if (aEmpty && bEmpty) return 0;
            if (aEmpty) return 1;
            if (bEmpty) return -1;

            if (aVal === bVal) return 0;
            return sortDir === 'asc'
                ? (aVal > bVal ? 1 : -1)
                : (aVal < bVal ? 1 : -1);
        });
        return arr;
    }, [shots, total, isGroupView, sortKey, sortDir, groupSortDir]);

    /* ── Build group1 / group2 totals from full dataset ──────────────── */
    const groupTotals = useMemo(() => {
        const group1ShotCount: { [g1: string]: number } = {};
        const group1Group2Set: { [g1: string]: Set<string> } = {};
        const group2ShotCount: { [key: string]: number } = {};

        (sortedAllShots || []).forEach(shot => {
            const g1 = shot.group_1;
            const g2 = shot.group_2;
            const key = `${g1}/${g2}`;

            group1ShotCount[g1] = (group1ShotCount[g1] || 0) + 1;
            if (!group1Group2Set[g1]) group1Group2Set[g1] = new Set();
            group1Group2Set[g1].add(g2);

            group2ShotCount[key] = (group2ShotCount[key] || 0) + 1;
        });

        const group1: { [g1: string]: { totalShots: number; totalGroup2s: number } } = {};
        Object.keys(group1ShotCount).forEach(g1 => {
            group1[g1] = {
                totalShots:   group1ShotCount[g1],
                totalGroup2s: group1Group2Set[g1].size,
            };
        });

        return {
            group1,
            group2: group2ShotCount,
        };
    }, [sortedAllShots]);

    const pagedShots: ShotPivot[] = useMemo(() => {
        if (!isGroupView) return shots;
        const start = effectivePage * pageProps.rowsPerPage;
        const end   = start + pageProps.rowsPerPage;
        return sortedAllShots.slice(start, end);
    }, [isGroupView, sortedAllShots, shots, effectivePage, pageProps.rowsPerPage]);

    const displayTotal = total;

    // Keep last non-empty groupCounts so filter menu doesn't empty during reload
    const stableGroupCounts = useRef<{ [key: string]: number }>({});
    if (Object.keys(groupCounts).length > 0) {
        stableGroupCounts.current = groupCounts;
    }

    const name1Options = useMemo(() => {
        const entries = Object.entries(stableGroupCounts.current || {})
            .filter(([key]) => key !== 'Ungrouped');

        const sorted = entries.sort((a, b) => b[1] - a[1]);

        return sorted.map(([key, count]) => ({
            id: key,
            label: `${key} (${count})`,
        }));
    }, [stableGroupCounts.current, filters.shotGroups]);

    const handleSortChange = (key: string) => {
        if (sortKey === key) {
            const newDir = sortDir === 'asc' ? 'desc' : 'asc';
            setSortDir(newDir);
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const handleGroupSortToggle = () => {
        setGroupSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    };

    // timezone
    const { currentStudio } = useCurrentStudio();
    const [timeZone, setTimeZone] = useState<string | undefined>();

    useEffect(() => {
        if (currentStudio == null) return;
        const controller = new AbortController();
        (async () => {
            try {
                const res: string | null = await queryConfig(
                    'studio',
                    currentStudio.key_name,
                    'timezone',
                ).catch(e => {
                    if (e.name === 'AbortError') return;
                    throw e;
                });
                if (res != null) setTimeZone(res);
            } catch (e) {
                console.error(e);
            }
        })();
        return () => controller.abort();
    }, [currentStudio]);

    const dateTimeFormat = new Intl.DateTimeFormat(
        undefined,
        {
            timeZone,
            dateStyle: 'medium',
            timeStyle: 'medium',
        },
    );

    const handleRowsPerPageChange: TablePaginationProps['onChangeRowsPerPage'] = event => {
        setPageProps({ page: 0, rowsPerPage: parseInt(event.target.value) });
    };

    const handlePageChange: TablePaginationProps['onChangePage'] = (_, newPage) => {
        setPageProps(prev => ({ ...prev, page: newPage }));
    };

    // Constants
    const PIPE_KEY_SHOTS = '/ppiTracker/shots/hiddenColumns';
    const FIXED_VISIBLE_IDS = new Set(['thumbnail', 'group_1_name', 'group_2_name', 'group_3_name']);

    // State - Use Set for hidden columns (like Assets page)
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

    // Load hidden columns from pipeline only (NO localStorage)
    useEffect(() => {
        let isMounted = true;
        
        const loadFromPipeline = async () => {
            if (!currentProject) return;
            
            const projectKey = currentProject.key_name;
            
            try {
                const { getAuthHeader, setNewToken } = await import('../../../auth/util');
                const { AuthorizationError } = await import('../../../auth/types');
                
                const headers = getAuthHeader();
                const encodedKey = encodeURIComponent(PIPE_KEY_SHOTS);
                const url = `/api/pipelineSetting/preference/projects/${encodeURIComponent(projectKey)}/values/${encodedKey}`;
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers,
                    mode: 'cors',
                });
                
                if (response.status === 401) {
                    throw new AuthorizationError();
                }
                
                // treat 404 as "no saved settings" - NOT an error
                if (response.status === 404) {
                    console.log('[ColumnVisibility] No saved settings found  - using defaults');
                    if (isMounted) {
                        setHiddenColumns(new Set());
                    }
                    return;
                }
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch: ${response.status}`);
                }
                
                setNewToken(response);
                const json = await response.json();
                const savedValue = json.value;
                
                if (savedValue && Array.isArray(savedValue) && isMounted) {
                    const sanitized = savedValue.filter((id: string) => !FIXED_VISIBLE_IDS.has(id));
                    setHiddenColumns(new Set(sanitized));
                    console.log('[ColumnVisibility] Loaded from pipeline:', sanitized);
                } else if (isMounted) {
                    setHiddenColumns(new Set());
                }
            } catch (error) {
                // Only log as error if it's not a 404
                if (error instanceof Error && !error.message.includes('404')) {
                    console.error('[ColumnVisibility] Pipeline load failed:', error);
                }
                if (isMounted) {
                    setHiddenColumns(new Set());
                }
            }
        };
        
        loadFromPipeline();
        
        return () => {
            isMounted = false;
        };
    }, [currentProject]);

    const saveHiddenColumnsToPipeline = async (cols: Set<string>) => {
        try {
            if (!currentProject || !currentProject.key_name) return;

            const { getAuthHeader, setNewToken } = await import('../../../auth/util');
            const { AuthorizationError } = await import('../../../auth/types');

            const headers = getAuthHeader();
            const encodedKey = encodeURIComponent(PIPE_KEY_SHOTS);
            const url = `/api/pipelineSetting/preference/projects/${encodeURIComponent(currentProject.key_name)}/values/${encodedKey}`;
            const columnsArray = Array.from(cols);

            let response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json',
                },
                mode: 'cors',
                body: JSON.stringify({ value: columnsArray }),
            });

            if (response.status === 404) {
                response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json',
                    },
                    mode: 'cors',
                    body: JSON.stringify({ value: columnsArray }),
                });
            }

            if (response.status === 401) {
                throw new AuthorizationError();
            }

            if (!response.ok) {
                throw new Error(`Failed to save hidden columns: ${response.status}`);
            }

            setNewToken(response);
        } catch (e) {
            console.error('[ColumnVisibility] Save failed:', e);
        }
    };

    const applyHiddenColumns = (next: Set<string>) => {
        setHiddenColumns(next);
        saveHiddenColumnsToPipeline(next);
    };

    // Convert hiddenColumns Set to ColumnState for components
    const columnsState = useMemo(() => {
        const defaultState = buildDefaultColumnState(phaseComponents);
        const state: { [key: string]: boolean } = {};
        
        // Start with all columns visible
        Object.keys(defaultState).forEach(id => {
            state[id] = true;
        });
        
        // Apply hidden columns
        hiddenColumns.forEach(id => {
            if (state.hasOwnProperty(id)) {
                state[id] = false;
            }
        });
        
        return state;
    }, [phaseComponents, hiddenColumns]);

    const tableFooter = (
        <ShotsDataTableFooter
            count={displayTotal}
            page={effectivePage}
            rowsPerPage={pageProps.rowsPerPage}
            onChangePage={handlePageChange}
            onChangeRowsPerPage={handleRowsPerPageChange}
        />
    );

    return (
        <StyledContainer maxWidth="xl">
            <ToolBarWrapper>
                <ShotDataTableToolbar
                    viewMode={viewMode}
                    onViewChange={(mode) => setViewMode(mode)}
                    searchValue={searchValue}
                    onSearchChange={(value: string) => setSearchValue(value)}
                    filters={filters}
                    onFilterChange={(newFilters: Filters) => setFilters(newFilters)}
                    columnsState={columnsState}
                    onColumnsChange={(newState) => {
                        // Convert ColumnState to hiddenColumns Set
                        const defaultState = buildDefaultColumnState(phaseComponents);
                        const newHidden = new Set<string>();
                        Object.keys(newState).forEach(id => {
                            if (!newState[id] && defaultState.hasOwnProperty(id)) {
                                newHidden.add(id);
                            }
                        });
                        applyHiddenColumns(newHidden);
                    }}
                    shotGroupOptions={name1Options}
                    groupSortDir={groupSortDir}
                    onGroupSortToggle={handleGroupSortToggle}
                    phaseComponents={phaseComponents}
                />
            </ToolBarWrapper>

            <StyledTableDiv>
                <StyledPaper>
                    {loading ? (
                        <div style={{
                            paddingTop: 50,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}>
                            <CircularProgress />
                        </div>
                    ) : (
                        <StyledContentDiv>
                            {viewMode === 'group' ? (
                                <ShotsDataTableGroup
                                    project={currentProject}
                                    shots={pagedShots}
                                    total={groupCounts}
                                    group1Totals={groupTotals.group1}
                                    group2Totals={groupTotals.group2}
                                    phaseComponents={phaseComponents}
                                    camDataTypes={camDataTypes}
                                    dateTimeFormat={dateTimeFormat}
                                    columnsState={columnsState}
                                    tableFooter={<></>}
                                    sortKey={sortKey}
                                    sortDir={sortDir}
                                    onSortChange={handleSortChange}
                                    selectedCellIds={selectedCellIds}
                                    onCellSelect={handleCellSelect}
                                    selectedRowId={selectedRowId}
                                    onRowSelect={handleRowSelect}
                                />
                            ) : (
                                <ShotsDataTable
                                    project={currentProject}
                                    shots={pagedShots}
                                    total={groupCounts}
                                    phaseComponents={phaseComponents}
                                    camDataTypes={camDataTypes}
                                    tableFooter={<></>}
                                    dateTimeFormat={dateTimeFormat}
                                    columnsState={columnsState}
                                    sortKey={sortKey}
                                    sortDir={sortDir}
                                    onSortChange={handleSortChange}
                                    selectedCellIds={selectedCellIds}
                                    onCellSelect={handleCellSelect}
                                    selectedRowId={selectedRowId}
                                    onRowSelect={handleRowSelect}
                                />
                            )}
                        </StyledContentDiv>
                    )}
                </StyledPaper>
            </StyledTableDiv>
            <CsvDownloadComponent
                currentProject={currentProject}
                />
            <FooterWrapper>
                {tableFooter}
            </FooterWrapper>
        </StyledContainer>
    );
};

export default ShotsDataTablePanel;
