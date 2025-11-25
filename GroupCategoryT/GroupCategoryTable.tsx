import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Chip,
  createStyles,
  FormControl,
  Input,
  ListItemIcon,
  makeStyles,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Theme,
  Typography,
  IconButton,
  Tooltip,
} from '@material-ui/core';
import { CheckBox, CheckBoxOutlineBlank } from '@material-ui/icons';
import ListIcon from '@material-ui/icons/List';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import { Directory } from '../../directory/types';
import { queryDirectories } from '../../directory/api';
import { Project } from '../types';
import { queryConfig, queryPreference } from '../../pipeline-setting/api';
import { Group, Category } from './types';
import { updateGroupCategory } from './api';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    paper: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
    },
    paperContainer: {
      backgroundColor: theme.palette.background.paper,
      display: 'flex',
      flexDirection: 'row',
    },
    categoryCell: {
      padding: 0,
    },
    formControl: {
      margin: theme.spacing(1),
    },
    chips: {
      display: 'flex',
      flexWrap: 'wrap',
    },
    chip: {
      margin: 2,
    },
    menuIcon: {
      minWidth: 40,
    },
    formPaper: {
      width: '100%',
      display: 'flex',
    },
    formRoot: {
      '& .MuiTextField-root': {
        margin: theme.spacing(1),
        marginRight: 0,
      },
      '& .MuiTextField-root:last-child': {
        marginRight: theme.spacing(1),
      },
    },
    buttonContainer: {
      '& > *': {
        margin: theme.spacing(1),
        marginTop: theme.spacing(0.5),
        marginRight: 0,
      },
      '& > *:last-child': {
        marginRight: theme.spacing(1),
      },
    },
  }),
);

export type FilterState = Readonly<{
  group: string,
}>;

type FilterFormProps = {
  filter: FilterState,
  setFilter: (filter: FilterState) => void,
};

export const FilterForm: React.FC<FilterFormProps> = ({ filter, setFilter }) => {
  const classes = useStyles();
  const [group, setGroup] = useState('');

  useEffect(() => {
    setGroup(filter.group);
  }, [filter]);

  const handleChangeGroup = (event: React.ChangeEvent<HTMLInputElement>) => {
    setGroup(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      handleFilterClick();
    }
  };

  const handleFilterClick = () => {
    setFilter({ ...filter, group });
  };

  const handleResetClick = () => {
    setGroup('');
    setFilter({ ...filter, group: '' });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <Paper className={classes.formPaper}>
      <form className={classes.formRoot} noValidate autoComplete="off" onSubmit={handleSubmit}>
        <div>
          <TextField
            id="group"
            label="Group"
            value={group}
            onChange={handleChangeGroup}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className={classes.buttonContainer}>
          <Button variant="outlined" onClick={handleResetClick}>Reset</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleFilterClick}
          >
            Filter
          </Button>
        </div>
      </form>
    </Paper>
  );
};

type Column = {
  id: 'root' | 'categories',
  label: string | ((root: string) => string),
};

type GroupCategoryTableProps = {
  project?: Project | null,
  root: string,
  categories: Category[],
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>,
  filter: FilterState,
};

// ---- Tree view helper types & functions (added) ----
type GroupTreeNode = {
  name: string;
  fullPath: string;
  children: GroupTreeNode[];
};

const buildGroupTree = (paths: string[]): GroupTreeNode[] => {
  type NodeMap = { [segment: string]: NodeMap };

  const root: NodeMap = {};

  paths.forEach(path => {
    const parts = path.split('/').filter(Boolean);
    let node = root;
    parts.forEach(part => {
      if (!node[part]) {
        node[part] = {};
      }
      node = node[part];
    });
  });

  const toNodes = (map: NodeMap, prefix = ''): GroupTreeNode[] =>
    Object.keys(map)
      .sort()
      .map(name => {
        const fullPath = prefix ? `${prefix}/${name}` : name;
        return {
          name,
          fullPath,
          children: toNodes(map[name], fullPath),
        };
      });

  return toNodes(root);
};
// ----------------------------------------------------

export const GroupCategoryTable: React.FC<GroupCategoryTableProps> = ({
  project,
  root,
  categories,
  setCategories,
  filter,
}) => {
  const classes = useStyles();
  const [publishDir, setPublishDir] = useState('');
  const [groupTitles, setGroupTitles] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list'); // NEW

  const columns = useMemo<Column[]>(() => [
    { id: 'root', label: root => 'Groups' + (root ? ` ( ${root} )` : '')},
    { id: 'categories', label: 'Categories' },
  ], []);

  useEffect(() => {
    if (publishDir !== '') {
      setPublishDir('');
    }

    if (project == null) {
      return;
    }

    const controller = new AbortController();

    (async () => {
      const res: string | null = await queryConfig(
        'common',
        'default',
        'publishDir',
        controller.signal,
      ).catch(err => {
        if (err.name === 'AbortError') {
          return;
        }
        console.error(err);
      });
      if (res != null) {
        setPublishDir(res);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [project]);

  useEffect(() => {
    if (groupTitles.length !== 0) {
      setGroupTitles([]);
    }
    if (project == null || root === '') {
      return;
    }

    const controller = new AbortController();

    (async () => {
      // The studio of the logged-in user cannot be determined because the authentication
      // feature has not been implemented yet.
      const studio = project.key_name == 'potoodev' ? 'ppidev' : 'ppi';

      const res: string[] | null = await queryPreference(
        'default',
        studio,
        project.key_name,
        `/ppip/roots/${root}/groups`,
        controller.signal,
      ).catch(err => {
        if (err.name === 'AbortError') {
          return;
        }
      });
      if (res != null) {
        setGroupTitles(res);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [project, root]);

  useEffect(() => {
    if (groups.length !== 0) {
      setGroups([]);
    }
    if (project == null || publishDir === '' || groupTitles.length === 0) {
      return;
    }

    const controller = new AbortController();

    (async () => {
      const groupPath = `${publishDir}/${root}`;
      const depth = groupPath.split('/').length + groupTitles.length;

      const res: Directory[] | void | null = await queryDirectories(
        project.key_name,
        depth,
        groupPath + '/',
        'active',
        controller.signal,
      ).catch(err => {
        if (err.name === 'AbortError') {
          return;
        }
        console.error(err);
      });
      if (res != null) {
        const start = groupPath.length + 1;
        setGroups(res.map<Group>(dir => ({ path: dir.path.substring(start) })));
      }
    })();

    return () => {
      controller.abort();
    };
  }, [project, publishDir, groupTitles]);

  type CategoriesTo = {
    add: Category[],
    remove: Category[],
  };

  const modifyGroupCategory = (id: number, operation: 'add' | 'remove', group: string) => {
    if (project == null) {
      return;
    }
    updateGroupCategory(
      project.key_name,
      id,
      operation,
      [group],
    ).then(res => {
      if (res == null) {
        return;
      }
      setCategories(
        categories.map(category => category.id === res.id ? res : category),
      );
    });
  };

  const handleChange = (event: React.ChangeEvent<{ value: unknown }>, group: Group) => {
    const valueStrings: string[] = event.target.value as any;
    const categoriesTo: CategoriesTo = { add: [], remove: [] };
    for (const category of categories) {
      const isCurrent = category.groups.includes(group.path);
      const isNew = valueStrings.includes(category.path);
      if (!isCurrent && isNew) {
        categoriesTo.add.push(category);
      } else if (isCurrent && !isNew) {
        categoriesTo.remove.push(category);
      }
    }

    for (const category of categoriesTo['add']) {
      modifyGroupCategory(category.id, 'add', group.path);
    }
    for (const category of categoriesTo['remove']) {
      modifyGroupCategory(category.id, 'remove', group.path);
    }
  };

  // build tree from groups for tree view
  const groupTree = useMemo<GroupTreeNode[]>(() => {
    if (!groups || groups.length === 0) {
      return [];
    }
    return buildGroupTree(groups.map(g => g.path));
  }, [groups]);

  const renderTreeRows = (nodes: GroupTreeNode[], depth = 0): React.ReactNode => {
    return nodes.map(node => (
      <React.Fragment key={node.fullPath}>
        <TableRow>
          <TableCell>
            <span style={{ paddingLeft: depth * 16, display: 'inline-block' }}>
              {node.name}
            </span>
          </TableCell>
          {/* tree view is read-only; leave categories column empty */}
          <TableCell className={classes.categoryCell} />
        </TableRow>
        {renderTreeRows(node.children, depth + 1)}
      </React.Fragment>
    ));
  };

  return (
    <Paper className={classes.paper}>
      <div className={classes.paperContainer}>
        {project != null
          ? (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {columns.map(column => (
                    <TableCell key={column.id}>
                      {column.id !== 'root' ? (
                        <>
                          {typeof column.label === 'function'
                            ? column.label(root)
                            : column.label}
                        </>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>
                            {typeof column.label === 'function'
                              ? column.label(root)
                              : column.label}
                          </span>
                          <span>
                            <Tooltip title="List View">
                              <IconButton
                                size="small"
                                onClick={() => setViewMode('list')}
                                style={{
                                  padding: 2,
                                  marginRight: 4,
                                  backgroundColor: viewMode === 'list' ? '#1976d2' : undefined,
                                }}
                              >
                                <ListIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Tree View">
                              <IconButton
                                size="small"
                                onClick={() => setViewMode('tree')}
                                style={{
                                  padding: 2,
                                  backgroundColor: viewMode === 'tree' ? '#1976d2' : undefined,
                                }}
                              >
                                <AccountTreeIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </span>
                        </div>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {/* original list view wrapped */}
                {viewMode === 'list' &&
                  groups
                    .filter(group =>
                      filter.group === ''
                      || group.path.toLowerCase().indexOf(filter.group.toLowerCase()) > -1,
                    )
                    .map(group => (
                      <TableRow key={group.path}>
                        <TableCell>
                          {group.path}
                        </TableCell>
                        <TableCell className={classes.categoryCell}>
                          {categories.length !== 0
                            ? (
                              <FormControl fullWidth className={classes.formControl}>
                                <Select
                                  labelId="group-categories-label"
                                  id="group-categories"
                                  multiple
                                  value={categories.filter(category =>
                                    category.groups.includes(group.path),
                                  ).map(category => category.path)}
                                  onChange={event => handleChange(event, group)}
                                  input={<Input id="select-group-categories" />}
                                  renderValue={(selected) => (
                                    <div className={classes.chips}>
                                      {(selected as string[]).map(value => (
                                        <Chip
                                          key={value}
                                          label={value}
                                          size="small"
                                          className={classes.chip}
                                        />
                                      ))}
                                    </div>
                                  )}
                                >
                                  {categories.map(category => (
                                    <MenuItem key={category.path} value={category.path} dense>
                                      <ListItemIcon className={classes.menuIcon}>
                                        {category.groups.includes(group.path)
                                          ? <CheckBox fontSize="small" />
                                          : <CheckBoxOutlineBlank fontSize="small" />}
                                      </ListItemIcon>
                                      <Typography variant="inherit">{category.path}</Typography>
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            )
                            : null}
                        </TableCell>
                      </TableRow>
                    ))}

                {/* tree view rows */}
                {viewMode === 'tree' && renderTreeRows(groupTree)}
              </TableBody>
            </Table>
          )
          : null}
      </div>
    </Paper>
  );
};

export default GroupCategoryTable;
