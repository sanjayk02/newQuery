import React, {
    FC,
    useEffect,
    useRef,
    useState,
} from 'react';
import { RouteComponentProps } from "react-router-dom";
import { Container, Paper, styled } from '@material-ui/core';
import { TablePaginationProps } from '@material-ui/core/TablePagination';
import { useShotsPivot } from './hooks';
import { PageProps } from './types';
import ShotsDataTable from './ShotsDataTable';
import ShotsDataTableFooter from './ShotsDataTableFooter';
import { useCurrentProject } from '../../hooks';
import { useCurrentStudio } from '../../../studio/hooks';
import { queryConfig } from '../../../new-pipeline-setting/api';
import ShotDataTableToolbar, {
    ViewMode,
    ColumnState,
    DEFAULT_COLUMN_STATE,
} from './ShotDataTableToolbar';

/* ── Client-side sort ──────────────────────────────────────────────────── */

/**
 * Maps a sortKey (backend orderKey) to the value we want to compare
 * from a ShotPivot row. Nulls / '-' always sort to the bottom.
 */
const getSortValue = (shot: import('./types').ShotPivot, key: string): string => {
    // Fixed columns
    if (key === 'group1_only')   return shot.group_1  ?? '';
    if (key === 'group2_only')   return shot.group_2  ?? '';
    if (key === 'group3_only')   return shot.group_3  ?? '';
    if (key === 'relation_only') return shot.relation ?? '';

    // Phase columns  e.g. "lay_work", "lay_appr", "lay_take", "lay_submitted"
    const workMatch      = key.match(/^(.+)_work$/);
    const apprMatch      = key.match(/^(.+)_appr$/);
    const takeMatch      = key.match(/^(.+)_take$/);
    const submittedMatch = key.match(/^(.+)_submitted$/);

    if (workMatch) {
        const v = shot.phases[workMatch[1]]?.work_status;
        return (!v || v === '-') ? '\uFFFF' : v;   // '\uFFFF' sorts after everything
    }
    if (apprMatch) {
        const v = shot.phases[apprMatch[1]]?.approval_status;
        return (!v || v === '-') ? '\uFFFF' : v;
    }
    if (takeMatch) {
        const v = shot.phases[takeMatch[1]]?.take;
        return (!v || v === '-') ? '\uFFFF' : v;
    }
    if (submittedMatch) {
        const v = shot.phases[submittedMatch[1]]?.submitted_at_utc;
        return (!v || v === '-') ? '\uFFFF' : v;
    }

    return '';
};

const sortShots = (
    shots:  import('./types').ShotPivot[],
    key:    string,
    dir:    'asc' | 'desc',
): import('./types').ShotPivot[] => {
    return [...shots].sort((a, b) => {
        const av = getSortValue(a, key);
        const bv = getSortValue(b, key);

        // Always push true nulls/empty to bottom regardless of direction
        if (av === '\uFFFF' && bv !== '\uFFFF') return 1;
        if (bv === '\uFFFF' && av !== '\uFFFF') return -1;

        const cmp = av.localeCompare(bv, undefined, { sensitivity: 'base' });
        return dir === 'asc' ? cmp : -cmp;
    });
};

/* ── Styled Components ─────────────────────────────────────────────────── */

const StyledContainer = styled(Container)(({ theme }) => ({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    padding: 0,
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
    minWidth: '100%',
}));

const StyledTableDiv = styled('div')({
    paddingBottom: 8,
    overflowX: 'auto',
    width: '100%',
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

/* ── Main Component ─────────────────────────────────────────────────────── */

const ShotsDataTablePanel: FC<RouteComponentProps> = () => {
    const [viewMode,     setViewMode]     = useState<ViewMode>('list');
    const [searchValue,  setSearchValue]  = useState<string>('');
    const [columnsState, setColumnsState] = useState<ColumnState>(DEFAULT_COLUMN_STATE);
    const [filters,      setFilters]      = useState<Filters>({
        shotGroups:     [],
        approvalStatus: [],
        workStatus:     [],
    });
    const [pageProps, setPageProps] = useState<PageProps>({
        page:        0,
        rowsPerPage: 15,
    });

    const { currentProject } = useCurrentProject();

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
    ]);


    const [sortKey, setSortKey]   = useState<string>('group1_only');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    // new pivot hook
    const { shots: rawShots, total } = useShotsPivot({
        project:        currentProject,
        page:           effectivePage + 1,  // API is 1-based
        perPage:        pageProps.rowsPerPage,
        nameKey:        searchValue,
        approvalStatus: filters.approvalStatus,
        workStatus:     filters.workStatus,
        orderKey:       sortKey,
        direction:      sortDir.toUpperCase(),
    });

    // Sort client-side to guarantee A→Z / Z→A order and nulls always last
    const shots = sortShots(rawShots, sortKey, sortDir);

    const handleSortChange = (key: string) => {
        console.log('🔄 Sort change triggered:', { 
            key, 
            currentSortKey: sortKey, 
            currentSortDir: sortDir 
        });
        
        if (sortKey === key) {
            // Toggle direction: ASC -> DESC -> ASC
            const newDir = sortDir === 'asc' ? 'desc' : 'asc';
            console.log(`🔄 Toggling direction: ${sortDir} -> ${newDir}`);
            setSortDir(newDir);
        } else {
            // New column, start with ASC
            console.log(`🔄 New column: ${key}, setting to ASC`);
            setSortKey(key);
            setSortDir('asc');
        }
        // Reset to first page when sorting changes
        setPageProps(prev => ({ ...prev, page: 0 }));
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

    const tableFooter = (
        <ShotsDataTableFooter
            count={total}
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
                    onViewChange={(mode: ViewMode) => setViewMode(mode)}
                    searchValue={searchValue}
                    onSearchChange={(value: string) => setSearchValue(value)}
                    filters={filters}
                    onFilterChange={(newFilters: Filters) => setFilters(newFilters)}
                    columnsState={columnsState}
                    onColumnsChange={setColumnsState}
                />
            </ToolBarWrapper>

            <StyledTableDiv>
                <StyledPaper>
                    <StyledContentDiv>
                        <ShotsDataTable
                            project={currentProject}
                            shots={shots}
                            tableFooter={<></>}
                            dateTimeFormat={dateTimeFormat}
                            columnsState={columnsState}
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSortChange={handleSortChange}
                        />
                    </StyledContentDiv>
                </StyledPaper>
            </StyledTableDiv>

            <FooterWrapper>
                {tableFooter}
            </FooterWrapper>

        </StyledContainer>
    );
};

export default ShotsDataTablePanel;