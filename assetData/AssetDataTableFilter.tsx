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

// MUI v4 panel components
import ExpansionPanel from '@material-ui/core/ExpansionPanel';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';

/* -------------------------------------------------------------- */
/* STYLES                                                          */
/* -------------------------------------------------------------- */

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
  justifyContent: 'space-between',
  width: '100%',
}));

const LeftWrap = styled('div')({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
});

const RightWrap = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: (theme.spacing as any)(1.5),
  marginRight: (theme.spacing as any)(1),
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

const FilterButtonWrap = styled('div')({
  display: 'flex',
  alignItems: 'center',
});

/* Compact drawer section: override paddings/margins and shrink fonts */
const StyledExpansionDetails = styled(ExpansionPanelDetails)(({ theme }) => ({
  paddingTop: 2,
  paddingBottom: 2,
  paddingLeft: 6,
  paddingRight: 6,
  display: 'flex',
  flexDirection: 'column',
  '& .MuiFormControlLabel-root': {
    marginLeft: -4,
    marginTop: 0,
    marginBottom: 0,
  },
  '& .MuiCheckbox-root': {
    padding: 2,
  },
  '& .MuiFormControlLabel-label': {
    fontSize: 11,
    whiteSpace: 'normal',
    wordBreak: 'break-word',
  },
}));

const PriorityText = styled('div')({
  fontSize: 10,
  opacity: 0.7,
  marginTop: 2,
});

/* Kill outer gaps on panels and summaries to remove extra space */
const CompactExpansionPanel = styled(ExpansionPanel)({
  margin: 0,
  padding: 0,
  boxShadow: 'none',
  borderRadius: 0,
  borderTop: '1px solid rgba(255,255,255,0.08)',
  '&:first-of-type': { borderTop: 'none' },
  '&:before': { display: 'none' },
  '&.Mui-expanded': { margin: 0 },
});

const CompactSummary = styled(ExpansionPanelSummary)({
  minHeight: 24,
  padding: '0 6px',
  '& .MuiExpansionPanelSummary-content': { margin: 0, padding: 0 },
  '& .MuiExpansionPanelSummary-content.Mui-expanded': { margin: 0 },
  '&.Mui-expanded': { minHeight: 24 },
});

/* -------------------------------------------------------------- */
/* CONSTANTS                                                       */
/* -------------------------------------------------------------- */

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

/* -------------------------------------------------------------- */
/* TYPES                                                           */
/* -------------------------------------------------------------- */

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
  const theme = useTheme();
  const MenuProps = {
    PaperProps: {
      style: { maxHeight: 48 * 4.5 + 8, width: 250 },
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

/* -------------------------------------------------------------- */
/* MAIN                                                             */
/* -------------------------------------------------------------- */

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
  const handleFilterKeyPress: TextFieldProps['onKeyPress'] = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      return false;
    }
  };

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const toggleDrawer = (open: boolean) => () => setDrawerOpen(open);

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
    (_e: any, value: boolean) => {
      setChecked((prev) => ({
        ...prev,
        [phase]: { ...prev[phase], [field]: value },
      }));
      onPhasePriorityChange(String(phase));
    };

  // NEW: toggle all helper
  const setAll = (value: boolean) => {
    setChecked({
      mdl: { work: value, appr: value, submitted: value },
      rig: { work: value, appr: value, submitted: value },
      bld: { work: value, appr: value, submitted: value },
      dsn: { work: value, appr: value, submitted: value },
      ldv: { work: value, appr: value, submitted: value },
    });
    // phasePriority stays as-is (we're just showing/hiding)
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
          {/* LEFT */}
          <LeftWrap>
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
          </LeftWrap>

          {/* RIGHT */}
          <RightWrap>
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

            <Button variant="outlined" onClick={onResetClick}>
              RESET
            </Button>
          </RightWrap>
        </StyledDiv>
      </StyledPaper>

      {/* Drawer RIGHT (fixed size + vertical scroll, offset from top) */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={toggleDrawer(false)}
        PaperProps={{
          style: {
            width: 200,          // fixed width
            height: '70vh',      // fixed height
            display: 'flex',
            position: 'fixed',
            top: 60,             // open a bit lower
            right: 0,
          },
        }}
        ModalProps={{ keepMounted: true }}
      >
        {/* container fills the paper and scrolls internally */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflowX: 'hidden',  // no horizontal scroll
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden', // no horizontal scroll
              paddingTop: 2,
            }}
          >
            {PHASES.map((phase) => (
              <CompactExpansionPanel key={phase.id} defaultExpanded>
                <CompactSummary expandIcon={<ExpandMoreIcon />}>
                  <strong>{phase.label}</strong>
                </CompactSummary>

                <StyledExpansionDetails>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={checked[phase.id].work}
                        onChange={handlePhaseFieldToggle(phase.id, 'work')}
                      />
                    }
                    label={`${phase.label} WORK STATUS`}
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

                  <PriorityText>
                    Priority:{' '}
                    <b>
                      {selectPhasePriority && typeof selectPhasePriority === 'string'
                        ? selectPhasePriority.toUpperCase()
                        : 'NONE'}
                    </b>
                  </PriorityText>
                </StyledExpansionDetails>
              </CompactExpansionPanel>
            ))}
          </div>

          {/* Drawer footer: Show all / Hide all + Close */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 8px',
            }}
          >
            <div>
              <Button size="small" onClick={() => setAll(true)}>
                Show all
              </Button>
              <Button size="small" onClick={() => setAll(false)}>
                Hide all
              </Button>
            </div>

            <Button onClick={toggleDrawer(false)}>Close</Button>
          </div>
        </div>
      </Drawer>
    </StyledFilterDiv>
  );
};

export default AssetTableFilter;
