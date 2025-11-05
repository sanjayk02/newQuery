import React from 'react';
import {
  Button,
  Chip,
  FormControl,
  Input,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Theme,
  Drawer,
  FormControlLabel,
  Checkbox,
  Divider,
} from '@material-ui/core';
import { styled, useTheme } from '@material-ui/core/styles';
import { ButtonProps } from '@material-ui/core/Button';
import { SelectProps } from '@material-ui/core/Select';
import { TextFieldProps } from '@material-ui/core/TextField';
import { ChipDeleteFunction } from './types';

import {
  ExpandMore as ExpandMoreIcon,
  ViewColumn as ViewColumnIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from '@material-ui/icons';

// MUI v4 names:
import ExpansionPanel from '@material-ui/core/ExpansionPanel';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';

const StyledChipsDiv = styled('div')({
  display: 'flex',
  flexWrap: 'wrap',
});

const StyledChip = styled(Chip)({
  margin: 2,
});

const StyledFormControl = styled(FormControl)(({ theme }) => ({
  margin: theme.spacing(1),
  minWidth: 120,
  maxWidth: 300,
}));

const StyledFilterDiv = styled('div')({
  minHeight: 70,
});

const StyledPaper = styled(Paper)({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'auto',
});

const StyledDiv = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
}));

const StyledFilterForm = styled('form')(({ theme }) => ({
  '& .MuiTextField-root': {
    margin: theme.spacing(1),
    marginRight: 0,
  },
  '& .MuiTextField-root:last-child': {
    marginRight: theme.spacing(1),
  },
}));

const StyledTextField = styled(TextField)({
  maxWidth: 200,
  minWidth: 180,
});

const StyledFilterResetForm = styled('form')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: theme.spacing(1),
  marginRight: theme.spacing(1),
  marginBottom: theme.spacing(0.5),
}));

const FilterButtonWrap = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginLeft: theme.spacing(1),
  marginRight: theme.spacing(1),
  marginTop: theme.spacing(1),
}));

/* ------------------------------------------------------------------ */
/* APPROVAL + WORK STATUS SELECT                                      */
/* ------------------------------------------------------------------ */

const approvalStatuses = [
  'check',
  'clientReview',
  'dirReview',
  'epdReview',
  'clientOnHold',
  'dirOnHold',
  'epdOnHold',
  'execRetake',
  'clientRetake',
  'dirRetake',
  'epdRetake',
  'clientApproved',
  'dirApproved',
  'epdApproved',
  'other',
  'omit',
];

const workStatuses = [
  'check',
  'cgsvOnHold',
  'svOnHold',
  'leadOnHold',
  'cgsvRetake',
  'svRetake',
  'leadRetake',
  'cgsvApproved',
  'svApproved',
  'leadApproved',
  'svOther',
  'leadOther',
];

function getStyles(name: string, statuses: string[], theme: Theme) {
  return {
    fontWeight:
      statuses.indexOf(name) === -1
        ? theme.typography.fontWeightRegular
        : theme.typography.fontWeightMedium,
  };
}

type StatusSelectProps = {
  statusType: string;
  statuses: string[];
  selectStatuses: string[];
  onStatusesChange: SelectProps['onChange'];
  onChipDelete: ChipDeleteFunction;
};

const FilterStatusSelect: React.FC<StatusSelectProps> = ({
  statusType,
  statuses,
  selectStatuses,
  onStatusesChange,
  onChipDelete,
}) => {
  const itemHeight = 48;
  const itemPaddingTop = 8;
  const theme = useTheme();
  const MenuProps = {
    PaperProps: {
      style: {
        maxHeight: itemHeight * 4.5 + itemPaddingTop,
        width: 250,
      },
    },
  };

  return (
    <StyledFormControl>
      <InputLabel id="filter-chip-label">{statusType}</InputLabel>
      <Select
        labelId="select-chip-label"
        multiple
        value={selectStatuses}
        onChange={onStatusesChange}
        input={<Input id="input-select-multiple-chip" />}
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
        MenuProps={MenuProps}
      >
        {statuses.map((status) => (
          <MenuItem
            key={status}
            value={status}
            style={getStyles(status, selectStatuses, theme)}
          >
            {status}
          </MenuItem>
        ))}
      </Select>
    </StyledFormControl>
  );
};

/* ------------------------------------------------------------------ */
/* PROPS                                                              */
/* ------------------------------------------------------------------ */

type FilterProps = {
  filterAssetName: string;
  selectApprovalStatuses: string[];
  selectWorkStatuses: string[];
  selectPhasePriority: string;
  onAssetNameChange: TextFieldProps['onChange'];
  onApprovalStatusesChange: SelectProps['onChange'];
  onWorkStatusesChange: SelectProps['onChange'];
  onPhasePriorityChange: (phase: string) => void;
  onApprovalStatusChipDelete: ChipDeleteFunction;
  onWorkStatusChipDelete: ChipDeleteFunction;
  onResetClick: ButtonProps['onClick'];
};

/* ------------------------------------------------------------------ */
/* MAIN                                                               */
/* ------------------------------------------------------------------ */

const AssetTableFilter: React.FC<FilterProps> = ({
  filterAssetName,
  selectApprovalStatuses,
  selectWorkStatuses,
  selectPhasePriority,
  onAssetNameChange,
  onApprovalStatusesChange,
  onWorkStatusesChange,
  onPhasePriorityChange,
  onApprovalStatusChipDelete,
  onWorkStatusChipDelete,
  onResetClick,
}) => {
  /* Prevent ENTER from submitting the form */
  const handleFilterKeyPress: TextFieldProps['onKeyPress'] = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      return false;
    }
  };

  /* Drawer toggle */
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const toggleDrawer = (open: boolean) => () => setDrawerOpen(open);

  /* Phase checkbox state */
  const [checked, setChecked] = React.useState<Record<
    string,
    Record<'work' | 'appr' | 'submitted', boolean>
  >>({
    mdl: { work: false, appr: false, submitted: false },
    rig: { work: false, appr: false, submitted: false },
    bld: { work: false, appr: false, submitted: false },
    dsn: { work: false, appr: false, submitted: false },
    ldv: { work: false, appr: false, submitted: false },
  });

  const handlePhaseFieldToggle =
    (phase: keyof typeof checked, field: 'work' | 'appr' | 'submitted') =>
    (_e: React.ChangeEvent<HTMLInputElement>, value: boolean) => {
      setChecked((prev) => ({
        ...prev,
        [phase]: { ...prev[phase], [field]: value },
      }));

      // mark phase priority
      onPhasePriorityChange(String(phase));
    };

  const PHASES: Array<{ id: 'mdl' | 'rig' | 'bld' | 'dsn' | 'ldv'; label: string }> = [
    { id: 'mdl', label: 'MDL' },
    { id: 'rig', label: 'RIG' },
    { id: 'bld', label: 'BLD' },
    { id: 'dsn', label: 'DSN' },
    { id: 'ldv', label: 'LDV' },
  ];

  return (
    <StyledFilterDiv>
      <StyledPaper>
        <StyledDiv>
          {/* Asset Name */}
          <StyledFilterForm>
            <StyledTextField
              id="filter-assetname"
              type="search"
              label="Asset Name"
              value={filterAssetName}
              onChange={onAssetNameChange}
              onKeyPress={handleFilterKeyPress}
            />
          </StyledFilterForm>

          {/* COLUMNS button */}
          <FilterButtonWrap>
            <Button
              variant="contained"
              color="primary"
              startIcon={<ViewColumnIcon />}
              endIcon={<ArrowDropDownIcon />}
              onClick={toggleDrawer(true)}
              style={{ borderRadius: 20, paddingLeft: 14, paddingRight: 10 }}
            >
              COLUMNS
            </Button>
          </FilterButtonWrap>

          {/* Approval Status */}
          <FilterStatusSelect
            statusType="Approval Status"
            statuses={approvalStatuses}
            selectStatuses={selectApprovalStatuses}
            onStatusesChange={onApprovalStatusesChange}
            onChipDelete={onApprovalStatusChipDelete}
          />

          {/* Work Status */}
          <FilterStatusSelect
            statusType="Work Status"
            statuses={workStatuses}
            selectStatuses={selectWorkStatuses}
            onStatusesChange={onWorkStatusesChange}
            onChipDelete={onWorkStatusChipDelete}
          />

          {/* RESET */}
          <StyledFilterResetForm>
            <Button variant="outlined" onClick={onResetClick}>
              RESET
            </Button>
          </StyledFilterResetForm>
        </StyledDiv>
      </StyledPaper>

      {/* Drawer RIGHT */}
      <Drawer anchor="right" open={drawerOpen} onClose={toggleDrawer(false)}>
        <div style={{ width: 280, paddingTop: 8 }}>
          {PHASES.map((phase) => (
            <React.Fragment key={phase.id}>
              <ExpansionPanel defaultExpanded>
                <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />}>
                  <strong>{phase.label}</strong>
                </ExpansionPanelSummary>

                <ExpansionPanelDetails style={{ display: 'block', paddingTop: 0 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={checked[phase.id].work}
                        onChange={handlePhaseFieldToggle(phase.id, 'work')}
                      />
                    }
                    label={`${phase.label} WORK`}
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={checked[phase.id].appr}
                        onChange={handlePhaseFieldToggle(phase.id, 'appr')}
                      />
                    }
                    label={`${phase.label} APPR`}
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={checked[phase.id].submitted}
                        onChange={handlePhaseFieldToggle(phase.id, 'submitted')}
                      />
                    }
                    label={`${phase.label} SUBMITTED AT`}
                  />

                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                    Priority:{' '}
                    <b>
                      {selectPhasePriority && typeof selectPhasePriority === 'string'
                        ? selectPhasePriority.toUpperCase()
                        : 'NONE'}
                    </b>
                  </div>
                </ExpansionPanelDetails>
              </ExpansionPanel>

              <Divider />
            </React.Fragment>
          ))}

          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 8 }}>
            <Button onClick={toggleDrawer(false)}>Close</Button>
          </div>
        </div>
      </Drawer>
    </StyledFilterDiv>
  );
};

export default AssetTableFilter;
