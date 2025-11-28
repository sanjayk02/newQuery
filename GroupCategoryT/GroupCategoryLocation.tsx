import React, { useEffect, useMemo, useState } from 'react';
import { queryPreference } from '../../pipeline-setting/api';
import { Project } from '../types';
import {
  Button,
  createStyles,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  makeStyles,
  Paper,
  Theme,
} from '@material-ui/core';
import { Category } from './types';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import AddDialog from './GroupCategoryAddDialog';
import DeleteDialog from './GroupCategoryDeleteDialog';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    },

    // header with Groups | Tree/List toggle
    headerRow: {
      display: 'flex',
      backgroundColor: theme.palette.background.paper,
      borderBottom: `1px solid ${theme.palette.divider}`,
      '& > div': {
        flex: 1,
        padding: theme.spacing(1),
        fontSize: 14,
        color: theme.palette.text.secondary,
        fontWeight: 500,
      },
    },

    // main 2-column area: roots | tree/list
    container: {
      width: '100%',
      backgroundColor: theme.palette.background.paper,
      display: 'flex',
      overflowY: 'auto',
      overflowX: 'hidden',
      '& > nav, & > div': {
        overflowY: 'auto',
        overflowX: 'hidden',
        marginRight: theme.spacing(0.5),
        flexShrink: 0,
        '&:first-child': {
          marginLeft: theme.spacing(0.5),
        },
      },
    },

    // the right column (tree / list) should expand
    mainColumn: {
      flexGrow: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },

    treeText: {
      fontFamily: 'monospace',
      fontSize: 14,
      whiteSpace: 'pre',
      margin: 0,
      padding: theme.spacing(0.1, 0),
      userSelect: 'text',
    },

    treeRow: {
      display: 'grid',
      gridTemplateColumns: '16px auto', // arrow | text
      alignItems: 'center',
      columnGap: theme.spacing(0.5),
      padding: '1px 0',
    },
  }),
);

// ---------------------------------------------------------------------------
// Root list
// ---------------------------------------------------------------------------

type RootListProps = {
  project: Project;
  selected: string;
  setSelected: React.Dispatch<React.SetStateAction<string>>;
};

const RootList: React.FC<RootListProps> = ({
  project,
  selected,
  setSelected,
}) => {
  const [roots, setRoots] = useState<string[]>([]);

  useEffect(() => {
    if (roots.length !== 0) {
      setRoots([]);
      setSelected('');
    }

    const controller = new AbortController();

    (async () => {
      const studio = project.key_name == 'potoodev' ? 'ppidev' : 'ppi';

      const res: string[] | null = await queryPreference(
        'default',
        studio,
        project.key_name,
        '/ppip/roots',
        controller.signal,
      ).catch(err => {
        if (err.name === 'AbortError') {
          return null;
        }
        console.error(err);
        return null;
      });

      if (res != null) {
        setRoots(res);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [project, setSelected]);

  return (
    <List component="nav">
      {roots.map((root, index) => (
        <ListItem
          button
          selected={selected === root}
          key={index}
          onClick={() => setSelected(root)}
        >
          {root}
        </ListItem>
      ))}
    </List>
  );
};

// ---------------------------------------------------------------------------
// Category list (editable – add/delete categories)
// ---------------------------------------------------------------------------

type GroupCategoryListProps = {
  project: Project;
  root: string;
  selected: Category | null;
  setSelected: React.Dispatch<React.SetStateAction<Category | null>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
};

const GroupCategoryList: React.FC<GroupCategoryListProps> = ({
  project,
  root,
  selected,
  setSelected,
  categories,
  setCategories,
}) => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryTitles, setCategoryTitles] = useState<string[]>([]);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(
    null,
  );

  useEffect(() => {
    if (categoryTitles.length !== 0) {
      setCategoryTitles([]);
    }

    const controller = new AbortController();

    (async () => {
      const studio = project.key_name == 'potoodev' ? 'ppidev' : 'ppi';

      const res: string[] | null = await queryPreference(
        'default',
        studio,
        project.key_name,
        `/ppip/roots/${root}/categories`,
        controller.signal,
      ).catch(err => {
        if (err.name === 'AbortError') {
          return null;
        }
        console.error(err);
        return null;
      });

      if (res != null) {
        setCategoryTitles(res);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [project.key_name, root]);

  const handleClickOpen = () => setAddDialogOpen(true);
  const handleAddDialogClose = () => setAddDialogOpen(false);

  const handleAddDialogAccept = (path: string) => {
    createGroupCategory(project.key_name, root, path)
      .catch(err => {
        console.error(err);
        return null;
      })
      .then(res => {
        if (res == null) {
          return;
        }
        setCategories(prev => [...prev, res]);
      });

    setAddDialogOpen(false);
  };

  const handleDeleteClick = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  const handleAcceptDeleteDialog = () => {
    if (categoryToDelete == null) {
      return;
    }

    deleteGroupCategory(project.key_name, categoryToDelete.id)
      .catch(err => {
        console.error(err);
      })
      .then(() => {
        setCategories(prev =>
          prev.filter(c => c.id !== categoryToDelete.id),
        );
      });

    setDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  return (
    <>
      <List component="nav">
        {categories.map(category => (
          <ListItem
            key={category.id}
            button
            selected={selected != null ? category.id === selected.id : false}
            onClick={() => setSelected(category)}
          >
            <ListItemText primary={category.path} />
            {category.groups.length === 0 && (
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  aria-label="delete"
                  onClick={() => handleDeleteClick(category)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            )}
          </ListItem>
        ))}
        {categoryTitles.length !== 0 && (
          <ListItem button onClick={handleClickOpen}>
            <ListItemIcon>
              <AddIcon fontSize="small" />
            </ListItemIcon>
          </ListItem>
        )}
      </List>

      <AddDialog
        root={root}
        categoryTitles={categoryTitles}
        open={addDialogOpen}
        onClose={handleAddDialogClose}
        onAccept={handleAddDialogAccept}
      />

      {categoryToDelete != null && (
        <DeleteDialog
          category={categoryToDelete}
          open={deleteDialogOpen}
          onClose={handleCloseDeleteDialog}
          onAccept={handleAcceptDeleteDialog}
        />
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Group list (within a category – deletable groups)
// ---------------------------------------------------------------------------

type GroupListProps = {
  project: Project;
  category: Category;
  onDelete: (category: Category) => void;
};

const GroupList: React.FC<GroupListProps> = ({
  project,
  category,
  onDelete,
}) => {
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDeleteClick = (group: string) => {
    setGroupToDelete(group);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setGroupToDelete(null);
  };

  const handleAcceptDeleteDialog = () => {
    if (groupToDelete == null) return;

    updateGroupCategory(
      project.key_name,
      category.id,
      'remove',
      [groupToDelete],
    ).then(res => {
      if (res == null) return;
      onDelete(res);
    });

    setDeleteDialogOpen(false);
    setGroupToDelete(null);
  };

  return (
    <>
      <List component="nav">
        {category.groups.map(group => (
          <ListItem key={group} button>
            {group}
            <ListItemSecondaryAction>
              <IconButton
                edge="end"
                aria-label="delete"
                onClick={() => handleDeleteClick(group)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      {groupToDelete != null && (
        <Dialog open={deleteDialogOpen} aria-labelledby="delete-dialog-title">
          <DialogTitle id="delete-dialog-title">Delete Group</DialogTitle>
          <DialogContent>
            <DialogContentText>Group: {groupToDelete}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
            <Button onClick={handleAcceptDeleteDialog} color="secondary">
              Accept
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Tree view (read-only, collapsible, ASCII-style)
// ---------------------------------------------------------------------------

type TreeNode = {
  name: string;
  fullPath: string;
  children: TreeNode[];
};

type GroupCategoryTreeProps = {
  categories: Category[];
};

const buildTreeFromCategories = (categories: Category[]): TreeNode[] => {
  type MapNode = {
    node: TreeNode;
    children: Record<string, MapNode>;
  };

  const root: Record<string, MapNode> = {};

  const getOrCreate = (
    map: Record<string, MapNode>,
    name: string,
    fullPath: string,
  ): MapNode => {
    if (!map[name]) {
      map[name] = {
        node: { name, fullPath, children: [] },
        children: {},
      };
    }
    return map[name];
  };

  categories.forEach(category => {
    const catParts = category.path.split('/').filter(Boolean);
    let current = root;
    let fullPath = '';

    catParts.forEach((part, idx) => {
      fullPath += (idx === 0 ? '' : '/') + part;
      current = getOrCreate(current, part, fullPath).children;
    });

    category.groups.forEach(groupPath => {
      const groupParts = groupPath.split('/').filter(Boolean);
      let groupCurrent = current;
      let groupFullPath = category.path;

      groupParts.forEach((part, idx) => {
        groupFullPath += '/' + part;
        groupCurrent = getOrCreate(groupCurrent, part, groupFullPath).children;
      });
    });
  });

  const toArray = (map: Record<string, MapNode>): TreeNode[] =>
    Object.values(map).map(({ node, children }) => ({
      ...node,
      children: toArray(children),
    }));

  return toArray(root);
};

const GroupCategoryTree: React.FC<GroupCategoryTreeProps> = ({
  categories,
}) => {
  const classes = useStyles();
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set<string>(),
  );

  const tree = useMemo(
    () => buildTreeFromCategories(categories),
    [categories],
  );

  const toggleNode = (path: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderNodes = (
    nodes: TreeNode[],
    depth = 0,
    parentIsLast: boolean[] = [],
  ): React.ReactNode[] => {
    return nodes.map((node, index) => {
      const isLast = index === nodes.length - 1;
      const hasChildren = node.children.length > 0;
      const isCollapsed = collapsed.has(node.fullPath);

      const prefixParts: string[] = [];
      for (let i = 0; i < depth; i++) {
        prefixParts.push(parentIsLast[i] ? '   ' : '│  ');
      }
      prefixParts.push(isLast ? '└─ ' : '├─ ');
      const prefix = prefixParts.join('');

      return (
        <React.Fragment key={node.fullPath}>
          <div className={classes.treeRow}>
            <span
              style={{
                cursor: hasChildren ? 'pointer' : 'default',
                userSelect: 'none',
              }}
              onClick={() => hasChildren && toggleNode(node.fullPath)}
            >
              {hasChildren ? (isCollapsed ? '▶' : '▼') : ' '}
            </span>
            <span className={classes.treeText}>
              {prefix}
              {node.name}
            </span>
          </div>

          {hasChildren && !isCollapsed &&
            renderNodes(node.children, depth + 1, [...parentIsLast, isLast])}
        </React.Fragment>
      );
    });
  };

  return <div>{renderNodes(tree)}</div>;
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type GroupCategoryLocationProps = {
  project?: Project | null;
  root: string;
  setRoot: React.Dispatch<React.SetStateAction<string>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
};

const GroupCategoryLocation: React.FC<GroupCategoryLocationProps> = ({
  project,
  root,
  setRoot,
  categories,
  setCategories,
}) => {
  const classes = useStyles();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');

  const handleDeleteGroup = (target: Category) => {
    setCategories(prev =>
      prev.map(c => (c.id === target.id ? target : c)),
    );
  };

  // keep selectedCategory in sync with categories
  useEffect(() => {
    if (selectedCategory == null) return;

    const found = categories.find(c => c.id === selectedCategory.id);
    if (found) setSelectedCategory(found);
    else setSelectedCategory(null);
  }, [categories, selectedCategory]);

  if (!project) {
    return null;
  }

  return (
    <Paper className={classes.root}>
      {/* header */}
      <div className={classes.headerRow}>
        <div>Groups</div>
        <div style={{ display: 'flex', gap: 24 }}>
          <span
            onClick={() => setViewMode('tree')}
            style={{
              cursor: 'pointer',
              fontWeight: viewMode === 'tree' ? 'bold' : 'normal',
            }}
          >
            Tree View
          </span>
          <span
            onClick={() => setViewMode('list')}
            style={{
              cursor: 'pointer',
              fontWeight: viewMode === 'list' ? 'bold' : 'normal',
            }}
          >
            List View
          </span>
        </div>
      </div>

      {/* main content */}
      <div className={classes.container}>
        {/* roots (left) */}
        <RootList project={project} selected={root} setSelected={setRoot} />

        {/* tree / list (right) */}
        <div className={classes.mainColumn}>
          {root !== '' && (
            <>
              {viewMode === 'tree' && (
                <GroupCategoryTree categories={categories} />
              )}

              {viewMode === 'list' && (
                <GroupCategoryList
                  project={project}
                  root={root}
                  selected={selectedCategory}
                  setSelected={setSelectedCategory}
                  categories={categories}
                  setCategories={setCategories}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* groups for selected category (below) */}
      {selectedCategory != null && (
        <GroupList
          project={project}
          category={selectedCategory}
          onDelete={handleDeleteGroup}
        />
      )}
    </Paper>
  );
};

export default GroupCategoryLocation;
