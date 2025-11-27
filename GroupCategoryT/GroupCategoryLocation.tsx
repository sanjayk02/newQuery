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
import { createGroupCategory, deleteGroupCategory, updateGroupCategory } from './api';
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

    // Header row for the tree view next to roots - Added New SanjayK -PSI
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

    container: {
      witdh: '100%',
      backgroundColor: theme.palette.background.paper,
      display: 'flex',
      overflow: 'auto hidden',
      '& > nav, & > div': {
        overflow: 'auto',
        marginRight: theme.spacing(0.5),
        flexShrink: 0,
        '&:first-child': {
          marginLeft: theme.spacing(0.5),
        },
      },
    },

    treeText: {
      fontFamily: 'monospace',
      fontSize: 12,
      whiteSpace: 'pre',
      margin: 0,
      padding: theme.spacing(0.25, 0),
    },

    // one column for tree text, one for icon
    treeRow: {
      display: 'grid',
      gridTemplateColumns: '260px auto', // text | icon
      alignItems: 'center',
    },

    treeIcon: {
      justifySelf: 'end',
      padding: 4,
    },
  }),
);

/* ------------------------------------------------------------------ */
/* Root list (unchanged)                                              */
/* ------------------------------------------------------------------ */

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
      // The studio of the logged-in user cannot be determined because the authentication
      // feature has not been implemented yet.
      const studio = project.key_name == 'potoodev' ? 'ppidev' : 'ppi';

      const res: string[] | null = await queryPreference(
        'default',
        studio,
        project.key_name,
        '/ppip/roots',
        controller.signal,
      ).catch(err => {
        if (err.name === 'AbortError') {
          return;
        }
        console.error(err);
      });
      if (res != null) {
        setRoots(res);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [project]);

  const handlelistItemClick = (root: string) => {
    setSelected(root);
  };

  return (
    <List component="nav">
      {roots.map((root, index) => (
        <ListItem
          button
          selected={selected === root}
          key={index}
          onClick={() => handlelistItemClick(root)}
        >
          {root}
        </ListItem>
      ))}
    </List>
  );
};

/* ------------------------------------------------------------------ */
/* GroupCategoryList (unchanged)                                      */
/* ------------------------------------------------------------------ */

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
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  useEffect(() => {
    if (categoryTitles.length !== 0) {
      setCategoryTitles([]);
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
        `/ppip/roots/${root}/categories`,
        controller.signal,
      ).catch(err => {
        if (err.name === 'AbortError') {
          return;
        }
        console.error(err);
      });
      if (res != null) {
        setCategoryTitles(res);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [root]);

  const handleListItemClick = (category: Category | null) => {
    setSelected(category);
  };

  const handleClickOpen = () => {
    setAddDialogOpen(true);
  };

  const handleAddDialogClose = () => {
    setAddDialogOpen(false);
  };

  const handleAddDialogAccept = (path: string) => {
    createGroupCategory(project.key_name, root, path)
      .catch(err => {
        console.error(err);
      })
      .then(res => {
        if (res == null) {
          return;
        }
        setCategories([...categories, res]);
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
        setCategories(categories.filter(c => c.id !== categoryToDelete.id));
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
            selected={selected != null ? category === selected : false}
            onClick={() => handleListItemClick(category)}
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

/* ------------------------------------------------------------------ */
/* GroupList (unchanged)                                              */
/* ------------------------------------------------------------------ */

type GroupListProps = {
  project: Project;
  category: Category;
  onDelete: (category: Category) => void;
};

const GroupList: React.FC<GroupListProps> = ({ project, category, onDelete }) => {
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
    if (groupToDelete == null) {
      return;
    }
    updateGroupCategory(project.key_name, category.id, 'remove', [groupToDelete]).then(
      res => {
        if (res == null) {
          return;
        }
        onDelete(res);
      },
    );
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

/* ------------------------------------------------------------------ */
/* Tree view with aligned delete icons                                */
/* ------------------------------------------------------------------ */

type TreeNode = {
  name: string;
  fullPath: string;
  children: TreeNode[];
  isGroup: boolean;
  category?: Category;
};

type GroupCategoryTreeProps = {
  categories: Category[];
  onRemoveGroup?: (category: Category, groupPath: string) => void;
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
    isGroup: boolean,
    category?: Category,
  ): MapNode => {
    if (!map[name]) {
      map[name] = {
        node: { name, fullPath, children: [], isGroup, category },
        children: {},
      };
    } else if (isGroup) {
      // if this node later becomes a group leaf, mark it
      map[name].node.isGroup = true;
      map[name].node.category = category;
    }
    return map[name];
  };

  categories.forEach(cat => {
    const catParts = cat.path.split('/').filter(Boolean);

    // category path
    let cur = root;
    let prefix = '';
    catParts.forEach(part => {
      const full = prefix ? `${prefix}/${part}` : part;
      const m = getOrCreate(cur, part, full, false);
      cur = m.children;
      prefix = full;
    });

    // groups under that category
    cat.groups.forEach(groupPath => {
      const parts = groupPath.split('/').filter(Boolean);
      let gCur = cur;
      let gPrefix = '';
      parts.forEach((part, idx) => {
        const isLeaf = idx === parts.length - 1;
        const full = isLeaf ? groupPath : gPrefix ? `${gPrefix}/${part}` : part;
        const m = getOrCreate(gCur, part, full, isLeaf, isLeaf ? cat : undefined);
        gCur = m.children;
        gPrefix = full;
      });
    });
  });

  const toNodes = (map: Record<string, MapNode>): TreeNode[] =>
    Object.values(map)
      .sort((a, b) => a.node.name.localeCompare(b.node.name))
      .map(m => ({
        ...m.node,
        children: toNodes(m.children),
      }));

  return toNodes(root);
};

const GroupCategoryTree: React.FC<GroupCategoryTreeProps> = ({
  categories,
  onRemoveGroup,
}) => {
  const classes = useStyles();

  const tree = useMemo(() => buildTreeFromCategories(categories), [categories]);

  const renderNodes = (
    nodes: TreeNode[],
    depth = 0,
    isLastArray: boolean[] = [],
  ): React.ReactNode =>
    nodes.map((node, index) => {
      const isLast = index === nodes.length - 1;
      const thisIsLastArray = [...isLastArray, isLast];

      // Build the ASCII prefix (camera/character have no vertical bar below)
      let prefix = '';
      if (depth > 0) {
        for (let i = 0; i < depth - 1; i++) {
          const isRootColumn = i === 0;
          if (isRootColumn) {
            // no vertical line in the first column under top-level nodes
            prefix += '   ';
          } else {
            prefix += thisIsLastArray[i] ? '   ' : '│  ';
          }
        }
        prefix += isLast ? '└─ ' : '├─ ';
      }

      const isLeafGroup =
        node.isGroup &&
        node.category &&
        (!node.children || node.children.length === 0);

      return (
        <React.Fragment key={node.fullPath}>
          <div className={classes.treeRow}>
            {/* left column: ASCII tree text */}
            <span
              className={classes.treeText}
              style={{ fontWeight: depth === 0 ? 'bold' : 'normal' }}
            >
              {prefix}
              {node.name}
            </span>

            {/* right column: delete icon only for leaf groups */}
            {isLeafGroup && onRemoveGroup ? (
              <IconButton
                size="small"
                className={classes.treeIcon}
                onClick={() => onRemoveGroup(node.category!, node.fullPath)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            ) : (
              <span /> // empty cell keeps column alignment
            )}
          </div>

          {renderNodes(node.children, depth + 1, thisIsLastArray)}
        </React.Fragment>
      );
    });

  return <div>{renderNodes(tree)}</div>;
};

/* ------------------------------------------------------------------ */
/* Wrapper: tree / list toggle                                        */
/* ------------------------------------------------------------------ */

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
    setCategories(categories.map(c => (c.id === target.id ? target : c)));
  };

  // Remove group from a category (used by tree delete icons)
  const handleRemoveGroup = (category: Category, groupPath: string) => {
    if (!project) {
      return;
    }
    updateGroupCategory(project.key_name, category.id, 'remove', [groupPath])
      .then(res => {
        if (res == null) {
          return;
        }
        setCategories(categories.map(c => (c.id === res.id ? res : c)));
      })
      .catch(err => {
        console.error(err);
      });
  };

  useEffect(() => {
    if (selectedCategory == null) {
      return;
    }
    for (const category of categories) {
      if (category.id === selectedCategory.id) {
        setSelectedCategory(category);
        return;
      }
    }
    setSelectedCategory(null);
  }, [categories]);

  return (
    <Paper className={classes.root}>
      {project != null && (
        <>
          {/* Header row for the tree view next to roots - Added New SanjayK -PSI */}
          <div className={classes.headerRow}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '150px 1fr',
                columnGap: '16px',
              }}
            >
              <div>Groups</div>
              {/* right header: Tree / list toggle view */}
              <div
                style={{
                  display: 'flex',
                  gap: 24,
                }}
              >
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
          </div>

          {/* Content area */}
          <div className={classes.container}>
            <RootList project={project} selected={root} setSelected={setRoot} />

            {root !== '' && (
              <>
                {viewMode === 'tree' && (
                  <GroupCategoryTree
                    categories={categories}
                    onRemoveGroup={handleRemoveGroup}
                  />
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
        </>
      )}
    </Paper>
  );
};

export default GroupCategoryLocation;
