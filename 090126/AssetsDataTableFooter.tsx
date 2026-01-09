import React from 'react';
import { IconButton, TablePagination } from '@material-ui/core';
import { TablePaginationProps } from '@material-ui/core/TablePagination';
import { styled } from '@material-ui/core/styles';
import {
  FirstPage as FirstPageIcon,
  KeyboardArrowLeft as KeyboardArrowLeftIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
  LastPage as LastPageIcon,
} from '@material-ui/icons';
import { IconButtonProps } from '@material-ui/core/IconButton';

/**
 * Sticky wrapper – must live inside the SAME element that scrolls (overflow: auto)
 * so `position: sticky; bottom: 0` sticks while scrolling.
 */
const StickyBar = styled('div')(({ theme }) => ({
  position: 'sticky',
  bottom: 0,
  zIndex: 20,
  backgroundColor: theme.palette.background.paper,
  borderTop: '1px solid rgba(255,255,255,0.08)',
}));

const StyledTablePagination = styled(TablePagination)(({ theme }) => ({
  width: '100%',
  // keep it on the right even when only few columns are visible
  '& .MuiToolbar-root': {
    justifyContent: 'flex-end',
    minHeight: 44,
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
  },
  '& .MuiTablePagination-spacer': {
    flex: '0 0 auto',
  },
}));

type TablePaginationActionsProps = {
  count: number;
  page: number;
  rowsPerPage: number;
  onChangePage: TablePaginationProps['onChangePage'];
};

export const TablePaginationActions: React.FC<TablePaginationActionsProps> = ({
  count,
  page,
  rowsPerPage,
  onChangePage,
}) => {
  const handleFirstButtonClick: IconButtonProps['onClick'] = (event) => {
    onChangePage(event, 0);
  };

  const handleBackButtonClick: IconButtonProps['onClick'] = (event) => {
    onChangePage(event, page - 1);
  };

  const handleNextButtonClick: IconButtonProps['onClick'] = (event) => {
    onChangePage(event, page + 1);
  };

  const handleLastButtonClick: IconButtonProps['onClick'] = (event) => {
    onChangePage(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1));
  };

  return (
    <>
      <IconButton onClick={handleFirstButtonClick} disabled={page === 0} aria-label="First Page">
        <FirstPageIcon />
      </IconButton>
      <IconButton onClick={handleBackButtonClick} disabled={page === 0} aria-label="Previous Page">
        <KeyboardArrowLeftIcon />
      </IconButton>
      <IconButton
        onClick={handleNextButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="Next Page"
      >
        <KeyboardArrowRightIcon />
      </IconButton>
      <IconButton
        onClick={handleLastButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="Last Page"
      >
        <LastPageIcon />
      </IconButton>
    </>
  );
};

type Props = {
  count: number;
  page: number;
  rowsPerPage: number;
  onChangePage: TablePaginationProps['onChangePage'];
  onChangeRowsPerPage: TablePaginationProps['onChangeRowsPerPage'];
};

/**
 * Use this footer INSIDE a scroll container.
 * Example:
 * <div style={{ overflow: 'auto' }}>
 *   <Table ... />
 *   <AssetsDataTableFooter ... />
 * </div>
 */
const AssetsDataTableFooter: React.FC<Props> = ({
  count,
  page,
  rowsPerPage,
  onChangePage,
  onChangeRowsPerPage,
}) => {
  return (
    <StickyBar>
      <StyledTablePagination
        component="div"
        rowsPerPageOptions={[15, 30, 60, 120, 240]}
        count={count}
        rowsPerPage={rowsPerPage}
        page={Math.min(page, Math.max(0, Math.ceil(count / rowsPerPage) - 1))}
        onChangePage={onChangePage}
        onChangeRowsPerPage={onChangeRowsPerPage}
        ActionsComponent={TablePaginationActions}
      />
    </StickyBar>
  );
};

export default AssetsDataTableFooter;
