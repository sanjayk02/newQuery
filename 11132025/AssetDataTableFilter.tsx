import React from 'react';
import {
  Button,
  Chip,
  Drawer,
  FormControl,
  FormControlLabel,
  Checkbox,
  Input,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
} from '@material-ui/core';
import { styled, useTheme } from '@material-ui/core/styles';
import { ButtonProps } from '@material-ui/core/Button';
import { SelectProps } from '@material-ui/core/Select';
import { TextFieldProps } from '@material-ui/core/TextField';
import { ChipDeleteFunction } from './types';

/* ──────────────────────────────────────────────────────────────────────────
 * Styles
 * ────────────────────────────────────────────────────────────────────────── */
const StyledChipsDiv = styled('div')({ display: 'flex', flexWrap: 'wrap' });
const StyledChip = styled(Chip)({ margin: 2 });
const StyledFormControl = styled(FormControl)(({ theme }) => ({
  margin: theme.spacing(1),
  minWidth: 160,
  maxWidth: 320,
}));
const StyledFilterForm = styled('form')(({ theme }) => ({
  '& .MuiTextField-root': { margin: theme.spacing(1), marginRight: 0, minWidth: 200 },
}));
const StyledTextField = styled(TextField)({ maxWidth: 260, minWidth: 200 });
const FilterButtonWrap = styled('div')({
  marginRight: 25,
  marginLeft: 8,
  border: '1px solid rgba(55, 35, 165, 0.08)',
  borderRadius: 20,
  display: 'flex',
  alignItems: 'center',
});
const DrawerPaper = styled(Paper)(({ theme }) => ({
  width: 320,
  padding: theme.spacing(2),
}));

/* ──────────────────────────────────────────────────────────────────────────
 * Status vocab (lowercase keys aligned with table/backend)
 * ────────────────────────────────────────────────────────────────────────── */
const approvalStatuses = [
  'check',
  // review family
  'review', 'clientReview', 'dirReview', 'epdReview',
  // on-hold family
  'clientOnHold', 'dirOnHold', 'epdOnHold',
  // retakes
  'execRetake', 'clientRetake', 'dirRetake', 'epdRetake',
  // approvals
  'clientApproved', 'dirApproved', 'epdApproved',
  'other', 'omit',
];

const workStatuses = [
  'check',
  'cgsvOnHold', 'svOnHold', 'leadOnHold',
  'cgsvRetake', 'svRetake', 'leadRetake',
  'cgsvApproved', 'svApproved', 'leadApproved',
  'svOther', 'leadOther',
];

function getStyles(name: string, selected: string[], theme: any) {
  return {
    fontWeight: selected.indexOf(name) === -1
      ? theme.typography.fontWeightRegular
      : theme.typography.fontWeightMedium,
  };
}

/* Drawer sections (ids must match table column ids) */
const COLUMN_SECTIONS: Array<{ title: string; items: Array<{ id: string; label: string }> }> = [
  { title: 'MDL', items: [
    { id: 'mdl_work_status', label: 'MDL WORK' },
    { id: 'mdl_approval_status', label: 'MDL APPR' },
    { id: 'mdl_submitted_at', label: 'MDL Submitted At' },
  ]},
  { title: 'RIG', items: [
    { id: 'rig_work_status', label: 'RIG WORK' },
    { id: 'rig_approval_status', label: 'RIG APPR' },
    { id: 'rig_submitted_at', label: 'RIG Submitted At' },
  ]},
  { title: 'BLD', items: [
    { id: 'bld_work_status', label: 'BLD WORK' },
    { id: 'bld_approval_status', label: 'BLD APPR' },
    { id: 'bld_submitted_at', label: 'BLD Submitted At' },
  ]},
  { title: 'DSN', items: [
    { id: 'dsn_work_status', label: 'DSN WORK' },
    { id: 'dsn_approval_status', label: 'DSN APPR' },
    { id: 'dsn_submitted_at', label: 'DSN Submitted At' },
  ]},
  { title: 'LDV', items: [
    { id: 'ldv_work_status', label: 'LDV WORK' },
    { id: 'ldv_approval_status', label: 'LDV APPR' },
    { id: 'ldv_submitted_at', label: 'LDV Submitted At' },
  ]},
  { title: 'OTHER', items: [{ id: 'relation', label: 'Relation' }]},
];

/* ──────────────────────────────────────────────────────────────────────────
 * Types & component
 * ────────────────────────────────────────────────────────────────────────── */
type StatusSelectProps = {
  statusType: string;
  statuses: string[];
  selectStatuses: string[];
  onStatusesChange: SelectProps['onChange'];
  onChipDelete: ChipDeleteFunction;
};

const FilterStatusSelect: React.FC<StatusSelectProps> = ({
  statusType, statuses, selectStatuses, onStatusesChange, onChipDelete,
}) => {
  const theme = useTheme();
  return (
    <StyledFormControl>
      <InputLabel id={`${statusType}-label`}>{statusType}</InputLabel>
      <Select
        labelId={`${statusType}-label`}
        multiple
        value={selectStatuses}
        onChange={onStatusesChange}
        input={<Input />}
        renderValue={(selected) => (
          <StyledChipsDiv>
            {(selected as string[]).map((value) => (
              <StyledChip
                key={value}
                label={value}
                onDelete={() => onChipDelete(value)}
                onMouseDown={(e) => e.stopPropagation()}
              />
            ))}
          </StyledChipsDiv>
        )}
        MenuProps={{ PaperProps: { style: { maxHeight: 48 * 4.5 + 8, width: 260 } } }}
      >
        {statuses.map((s) => (
          <MenuItem key={s} value={s} style={getStyles(s, selectStatuses, theme)}>
            {s}
          </MenuItem>
        ))}
      </Select>
    </StyledFormControl>
  );
};

type FilterProps = {
  // filters
  filterAssetName: string;
  selectApprovalStatuses: string[];
  selectWorkStatuses: string[];
  onAssetNameChange: TextFieldProps['onChange'];
  onApprovalStatusesChange: SelectProps['onChange'];
  onWorkStatusesChange: SelectProps['onChange'];
  onApprovalStatusChipDelete: ChipDeleteFunction;
  onWorkStatusChipDelete: ChipDeleteFunction;
  onResetClick: ButtonProps['onClick'];

  // columns
  hiddenColumns: Set<string>;
  onToggleColumn: (id: string) => void;

  // drawer
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
};

const AssetTableFilter: React.FC<FilterProps> = ({
  filterAssetName,
  selectApprovalStatuses,
  selectWorkStatuses,
  onAssetNameChange,
  onApprovalStatusesChange,
  onWorkStatusesChange,
  onApprovalStatusChipDelete,
  onWorkStatusChipDelete,
  onResetClick,

  hiddenColumns,
  onToggleColumn,

  drawerOpen,
  setDrawerOpen,
}) => {
  return (
    <>
      <StyledFilterForm>
        <StyledTextField
          label="Asset Name"
          value={filterAssetName}
          onChange={onAssetNameChange}
          variant="outlined"
          size="small"
        />

        <FilterStatusSelect
          statusType="Approval Status"
          statuses={approvalStatuses}
          selectStatuses={selectApprovalStatuses}
          onStatusesChange={onApprovalStatusesChange}
          onChipDelete={onApprovalStatusChipDelete}
        />

        <FilterStatusSelect
          statusType="Work Status"
          statuses={workStatuses}
          selectStatuses={selectWorkStatuses}
          onStatusesChange={onWorkStatusesChange}
          onChipDelete={onWorkStatusChipDelete}
        />

        <FilterButtonWrap>
          <Button variant="outlined" color="primary" onClick={() => setDrawerOpen(true)}>
            COLUMNS
          </Button>
          <Button style={{ marginLeft: 8 }} variant="outlined" onClick={onResetClick}>
            RESET
          </Button>
        </FilterButtonWrap>
      </StyledFilterForm>

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <DrawerPaper square>
          {COLUMN_SECTIONS.map((sec) => (
            <div key={sec.title} style={{ marginBottom: 12 }}>
              <div style={{ opacity: 0.7, marginBottom: 4, fontSize: 12 }}>{sec.title}</div>
              {sec.items.map((it) => (
                <FormControlLabel
                  key={it.id}
                  control={
                    <Checkbox
                      color="primary"
                      checked={!hiddenColumns.has(it.id)}
                      onChange={() => onToggleColumn(it.id)}
                    />
                  }
                  label={it.label}
                />
              ))}
            </div>
          ))}
        </DrawerPaper>
      </Drawer>
    </>
  );
};

export default AssetTableFilter;
