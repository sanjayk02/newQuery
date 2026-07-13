import csv
from logging import getLogger
from typing import Any, Iterator

from ppilib.core.launcher import AppInfo
from ppilib.core.phase.structure2 import Group
from ppilib.desktop.setting import DesktopPipelineSetting  # noqa: F401
from ppui.PySide.QtCore import (
    QEvent,  # noqa: F401
    QItemSelectionModel,
    QModelIndex,
    QObject,
    QPersistentModelIndex,
    QPoint,
    QSize,
    QSortFilterProxyModel,
    Qt,
    QTimer,
    Signal,
)
from ppui.PySide.QtGui import (
    QAction,
    QColor,
    QIcon,
    QImage,
    QPalette,
    QPixmap,
    QStandardItem,
    QStandardItemModel,
)
from ppui.PySide.QtWidgets import (
    QAbstractItemView,
    QButtonGroup,
    QCheckBox,
    QComboBox,
    QDialog,
    QFileDialog,
    QHeaderView,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMenu,
    QMenuBar,
    QMessageBox,
    QPushButton,
    QSizePolicy,
    QSpacerItem,
    QStyledItemDelegate,
    QTableView,
    QTreeView,
    QWidget,
    QVBoxLayout,
)

from .apiClient import ApiClient
from .centralClient import Sections
from .columnManagerDialog import ColumnListDialog
from .config import CsvEntityData
from .confirmImportDialog import ConfirmImportDialog
from .entityEditorDialog import CheckableComboBox, EntityEditorDialog
from .roleManagerDialog import RoleManagerDialog
from .service import LoadThumbnailPathsTask, LoadThumbnailTask, Service, ThreadPool, ThumbnailPaths
from .state import State
from .tableData import Column, Entity, DataRepository
from .userRole import RoleManager  # noqa: F401
from .ui.mainWindow import Ui_MainWindow
from .userRole import Permission

_logger = getLogger(__name__)

READ_ONLY_COLUMN_KEYS = ('name', 'thumbnail', 'cut_number')
GENERATED_COLUMN_KEYS = ('cut_number',)


class LoadColumnsTask(QObject):
    """Fetches column definitions and role overrides off the main thread."""

    columnsLoaded: Signal = Signal(list, dict)  # type: ignore

    def __init__(self, api: ApiClient, state: State) -> None:
        super().__init__()
        self._api = api
        self._state = state

    def run(self) -> None:
        dbColumns = self._api.getColumns()
        roleOverridesByRoot = {
            root: self._state.columnRoleOverrides(root) for root in ('assets', 'shots')
        }
        self.columnsLoaded.emit(dbColumns, roleOverridesByRoot)


class LoadRoleDataTask(QObject):
    """Fetches role preference data off the main thread."""

    roleDataLoaded: Signal = Signal(object)  # type: ignore

    def __init__(self, state: State) -> None:
        super().__init__()
        self._state = state

    def run(self) -> None:
        roleData = self._state.loadRolePreference()
        self.roleDataLoaded.emit(roleData)


class LoadEntitiesTask(QObject):
    """Fetches entity search results for a single root off the main thread."""

    entitiesLoaded: Signal = Signal(str, list)  # type: ignore

    def __init__(
        self,
        api: ApiClient,
        root: str,
        sortKey: str,
        sortDirection: int,
    ) -> None:
        super().__init__()
        self._api = api
        self._root = root
        self._sortKey = sortKey
        self._sortDirection = sortDirection

    def run(self) -> None:
        rawEntities = self._api.searchEntities(
            '',
            self._root,
            self._sortKey,
            self._sortDirection,
        )
        self.entitiesLoaded.emit(self._root, rawEntities)


class InlineCellEditDelegate(QStyledItemDelegate):
    def __init__(self, owner: 'DataWidget', parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._owner = owner

    def createEditor(self, parent: QWidget, option, index: QModelIndex) -> QWidget | None:
        column = self._owner.columnForIndex(index)
        if column is None or not self._owner.canDirectEditCell(index, showWarning=False):
            return None

        dtype = column.dataType()
        if dtype == 'array':
            options = column.config().get('options', [])
            if not options:
                return QLineEdit(parent)
            if column.config().get('multi_select', False):
                editor = CheckableComboBox(parent)
            else:
                editor = QComboBox(parent)
                editor.addItem('')
            editor.addItems(options)
            return editor
        if dtype in ('int', 'float'):
            return QLineEdit(parent)
        if dtype == 'bool':
            return QCheckBox(parent)
        if dtype == 'string':
            return QLineEdit(parent)
        return None

    def setEditorData(self, editor: QWidget, index: QModelIndex) -> None:
        column = self._owner.columnForIndex(index)
        if column is None:
            return

        value = self._owner.valueForIndex(index, column)
        if isinstance(editor, CheckableComboBox):
            values = [val.strip() for val in str(value or '').split(',') if val.strip()]
            for row in range(editor.model().rowCount()):
                item = editor.model().item(row)
                if item.text() in values:
                    item.setCheckState(Qt.CheckState.Checked)
            editor.updateDisplayText()
        elif isinstance(editor, QComboBox):
            editor.setCurrentText(str(value or ''))
        elif isinstance(editor, QCheckBox):
            editor.setChecked(str(value).lower() in ('true', '1') if isinstance(value, str) else bool(value))
        elif isinstance(editor, QLineEdit):
            editor.setText(str(value or ''))

    def setModelData(self, editor: QWidget, model, index: QModelIndex) -> None:
        column = self._owner.columnForIndex(index)
        if column is None:
            return

        if isinstance(editor, CheckableComboBox):
            value = ', '.join(editor.getCheckedItems())
        elif isinstance(editor, QComboBox):
            value = editor.currentText()
        elif isinstance(editor, QCheckBox):
            value = editor.isChecked()
        elif isinstance(editor, QLineEdit):
            text = editor.text()
            if column.dataType() == 'int':
                try:
                    value = int(text)
                except ValueError:
                    QMessageBox.warning(editor, 'Invalid Value', 'Please enter a valid integer.')
                    return
            elif column.dataType() == 'float':
                try:
                    value = float(text)
                except ValueError:
                    QMessageBox.warning(editor, 'Invalid Value', 'Please enter a valid number.')
                    return
            else:
                value = text
        else:
            return

        self._owner.saveDirectCellEdit(index, column, value)


class KeywordFilterProxyModel(QSortFilterProxyModel):
    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self._pattern = ''
        self._keywords: list[str] = []

    def setKeywordFilterPattern(self, text: str):
        self._pattern = text.lower()
        self._keywords = [k for k in self._pattern.split() if k]
        self.invalidateFilter()

    def filterAcceptsRow(
        self,
        source_row: int,
        source_parent: QModelIndex | QPersistentModelIndex,
    ) -> bool:
        if not self._keywords:
            return True

        model = self.sourceModel()
        cols = model.columnCount(source_parent)

        for kw in self._keywords:
            kwFound = False
            for col in range(cols):
                index = model.index(source_row, col, source_parent)
                data = model.data(index, Qt.ItemDataRole.UserRole + 3)
                if data is not None and kw in str(data).lower():
                    kwFound = True
                    break
            if not kwFound:
                return False
        return True


class CornerWidget(QWidget):
    def __init__(self, text: str, menuBar: QMenuBar) -> None:
        super(CornerWidget, self).__init__(parent=menuBar)
        self._layout = QVBoxLayout()
        self._layout.setContentsMargins(9, 3, 9, 3)
        self._label = QLabel(text, parent=self)
        self._layout.addWidget(self._label)
        self.setLayout(self._layout)

    def setText(self, text: str) -> None:
        self._label.setText(text)


class MainWindow(QMainWindow, Ui_MainWindow):
    def __init__(
        self,
        appInfo: AppInfo,
        state: State,
        isDev: bool,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self._appInfo = appInfo
        self._state = state
        self._pipelineSetting = state.pipelineSetting()
        self._service = Service(self._pipelineSetting)
        self._isDev = isDev
        _project = self._pipelineSetting.project()
        assert _project is not None, 'No project selected in pipeline setting.'
        self._project = _project
        _studio = self._pipelineSetting.studio()
        assert _studio is not None, 'No studio selected in pipeline setting.'
        self._studio = _studio

        self._api = ApiClient(self._pipelineSetting, isDev=self._isDev)
        self._dataRepo = DataRepository(self._isDev)
        self._roleManager = state.roleManager()
        self._threadPool = ThreadPool()

        self._columns: list[Column] = []
        self._assetsEntities: dict[str, Entity | None] = {}
        self._assetsHeaderMap: list[str] = []
        self._shotsEntities: dict[str, Entity | None] = {}
        self._shotsHeaderMap: list[str] = []
        self._thumbnailPathsTasks: dict[str, LoadThumbnailPathsTask] = {}
        self._thumbnailTasks: dict[str, LoadThumbnailTask] = {}
        self._columnsTask: LoadColumnsTask | None = None
        self._roleDataTask: LoadRoleDataTask | None = None
        self._thumbnailCache: dict[str, dict[str, QIcon]] = {
            'assets': {},
            'shots': {},
        }

        self.setupUi(self)

        self._rootsButtonGroup = QButtonGroup(self)
        self._assetsButton = CheckableButton(' Assets', QIcon(':/child_w.png'), self)
        self._shotsButton = CheckableButton(' Shots', QIcon(':/film_w.png'), self)
        self._rootsButtonGroup.addButton(self._assetsButton)
        self._rootsButtonGroup.addButton(self._shotsButton)
        self._spacer = QSpacerItem(1, 0, QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Minimum)
        self.rootButtonHLayout.insertWidget(0, self._assetsButton)
        self.rootButtonHLayout.insertWidget(1, self._shotsButton)
        self.rootButtonHLayout.addItem(self._spacer)

        self._exportCsvButton = QPushButton(' Export CSV')
        self._exportCsvButton.setIcon(QIcon(':/export.png'))
        self._exportCsvButton.setMinimumWidth(120)
        self._importCsvButton = QPushButton(' Import CSV')
        self._importCsvButton.setIcon(QIcon(':/import.png'))
        self._importCsvButton.setMinimumWidth(120)
        self.rootButtonHLayout.addWidget(self._importCsvButton)
        self.rootButtonHLayout.addWidget(self._exportCsvButton)

        self._assetsTableWidget = TableWidget(
            self._service,
            self._api,
            self._state,
            self._columns,
            self._thumbnailCache['assets'],
            'assets',
            self,
        )
        self._shotsTreeWidget = TreeWidget(
            self._service,
            self._api,
            self._state,
            self._columns,
            self._thumbnailCache['shots'],
            'shots',
            self,
        )
        self.verticalLayout.addWidget(self._assetsTableWidget)
        self.verticalLayout.addWidget(self._shotsTreeWidget)

        self._currentSortKey = 'name'
        self._currentSortDirection = 1
        self._currentRoot = 'assets'
        self._dataWidgets: dict[str, 'DataWidget'] = {
            'assets': self._assetsTableWidget,
            'shots': self._shotsTreeWidget,
        }

        self._aboutDialog = None
        self._cornerWidget = None

        self.refreshButton.clicked.connect(self._onRefreshClicked)
        self._rootsButtonGroup.buttonToggled.connect(self.changeRootButtonToggled)
        self.columnManagerButton.clicked.connect(self._manageColumns)
        self.roleManagerButton.clicked.connect(self._manageRoles)

        self._exportCsvButton.clicked.connect(self._onExportCsvClicked)
        self._importCsvButton.clicked.connect(self._onImportCsvClicked)

        self._genaratedMenu()

        self._assetsTableWidget.setVisible(self._currentRoot == 'assets')
        self._shotsTreeWidget.setVisible(self._currentRoot == 'shots')
        self._setRootButton(self._currentRoot)
        self.roleManagerButton.setVisible(self._state.isAdmin())

        # Data (columns, entities, thumbnails) is fetched asynchronously so the
        # window can be shown immediately; QTimer.singleShot(0, ...) defers this
        # until after the event loop starts, i.e. after the first paint.
        QTimer.singleShot(0, self._startInitialLoad)

    def _startInitialLoad(self) -> None:
        self._loadColumnsAsync()
        self._loadRoleDataAsync()

    def _loadRoleDataAsync(self) -> None:
        task = LoadRoleDataTask(self._state)
        task.roleDataLoaded.connect(self._onRoleDataLoaded)
        self._roleDataTask = task
        self._threadPool.start(task)

    def _onRoleDataLoaded(self, roleData: 'OrderedDict[Role, list[str]]') -> None:
        self._roleDataTask = None
        self._state.applyRoleData(roleData)
        self._roleManager = self._state.roleManager()
        self._refreshRoleDependentUi()

    def _refreshRoleDependentUi(self) -> None:
        if self._cornerWidget is not None:
            text = (
                f'{self._studio.displayName()}'
                f' / {self._roleManager.userName()}'
                f' / {self._roleManager.currentRoleName()}'
            )
            self._cornerWidget.setText(text)
        self.roleManagerButton.setVisible(self._state.isAdmin())

    def _loadColumnsAsync(self) -> None:
        task = LoadColumnsTask(self._api, self._state)
        task.columnsLoaded.connect(self._onColumnsLoaded)
        self._columnsTask = task
        self._threadPool.start(task)

    def _onColumnsLoaded(
        self,
        dbColumns: list[Any],
        roleOverridesByRoot: dict[str, dict[str, str]],
    ) -> None:
        self._columnsTask = None
        self._rebuildColumns(dbColumns, roleOverridesByRoot)
        self._beginStagedInitialLoad()

    def _beginStagedInitialLoad(self) -> None:
        # Headers are cheap/local, so set them for both roots immediately -
        # switching tabs looks correct even before any row data has arrived.
        self._assetsTableWidget.refreshColumns(list(self._collectColumns('assets')))
        self._shotsTreeWidget.refreshColumns(list(self._collectColumns('shots')))

        visibleRoot = self._currentRoot
        hiddenRoot = 'shots' if visibleRoot == 'assets' else 'assets'
        self._loadRootStaged(visibleRoot, nextRoot=hiddenRoot)

    def _loadRootStaged(self, root: str, nextRoot: str | None) -> None:
        widget = self._dataWidgets[root]

        def _onStageDone() -> None:
            widget.dataLoaded.disconnect(_onStageDone)
            # Rows for this root are in; now load its thumbnails.
            self._resetTasks(root)
            self._loadThumbnail(root)
            if nextRoot is not None:
                self._loadRootStaged(nextRoot, nextRoot=None)

        widget.dataLoaded.connect(_onStageDone)
        widget.refreshData()

    def _genaratedMenu(self):
        # Help Menu
        self._actionAboutPpiBreakdown = QAction('About PPI Breakdown...', self)
        self.menuHelp.addAction(self._actionAboutPpiBreakdown)
        self._actionAboutPpiBreakdown.triggered.connect(self._showAboutDialog)
        self._ppiBreakdownHelp = QAction('PPI Breakdown Help', self)
        self.menuHelp.addAction(self._ppiBreakdownHelp)
        self._ppiBreakdownHelp.triggered.connect(self._showHelpDocument)

        # Corner Widget
        text = (
            f'{self._studio.displayName()}'
            f' / {self._roleManager.userName()}'
            f' / {self._roleManager.currentRoleName()}'
        )
        self._cornerWidget = CornerWidget(text, self.menuBar())
        self.menuBar().setCornerWidget(self._cornerWidget)

    def _showAboutDialog(self):
        if self._aboutDialog is None:
            from ppui.desktop.widget.aboutDialog import AboutDialog

            self._aboutDialog = AboutDialog(self._appInfo, self)
        self._aboutDialog.show()

    def _showHelpDocument(self):
        import webbrowser

        url = self._pipelineSetting.preference().get('/ppiToolsDocument/url')
        if url:
            webbrowser.open(url + '/toolList/ppiBreakdown/')

    def _onRefreshClicked(self) -> None:
        for cache in self._thumbnailCache.values():
            cache.clear()
        self._refresh()

    def _onExportCsvClicked(self) -> None:
        widget = self._dataWidgets.get(self._currentRoot)
        if widget:
            widget.exportCsv()

    def _onImportCsvClicked(self) -> None:
        widget = self._dataWidgets.get(self._currentRoot)
        if widget:
            widget.importCsv()

    def _refresh(self, force: bool = False) -> None:
        if force or self._currentRoot == 'assets':
            _columns = list(self._collectColumns('assets'))
            self._assetsTableWidget.refresh(_columns)
        if force or self._currentRoot == 'shots':
            _columns = list(self._collectColumns('shots'))
            self._shotsTreeWidget.refresh(_columns)
        root = None if force else self._currentRoot
        self._resetTasks(root)
        self._loadThumbnail(root)

    def _setRootButton(self, root: str) -> None:
        isBlocked = self._rootsButtonGroup.blockSignals(True)
        try:
            if root == 'assets':
                self._assetsButton.setChecked(True)
            elif root == 'shots':
                self._shotsButton.setChecked(True)
        finally:
            self._rootsButtonGroup.blockSignals(isBlocked)

    def _rebuildColumns(
        self,
        dbColumns: list[Any] | None = None,
        roleOverridesByRoot: dict[str, dict[str, str]] | None = None,
    ) -> None:
        # dbColumns/roleOverridesByRoot may be prefetched on a background thread
        # (see LoadColumnsTask). When omitted, fall back to fetching synchronously
        # for call sites that run after user interaction (e.g. column manager dialog).
        project = self._project.keyName()
        tempColumns = list(self._dataRepo.loadTemplateColumns(project))
        if dbColumns is None:
            dbColumns = self._api.getColumns()
        tempExistKeys = {col.key() for col in tempColumns}
        for dbCol in dbColumns:
            column = Column.fromDict(dbCol)
            if dbCol['key'] not in tempExistKeys:
                tempColumns.append(column)
            else:
                for i, tempCol in enumerate(tempColumns):
                    if tempCol.key() == dbCol['key']:
                        tempColumns[i] = column
                        break
        if roleOverridesByRoot is None:
            roleOverridesByRoot = {
                root: self._state.columnRoleOverrides(root) for root in ('assets', 'shots')
            }
        for root in ('assets', 'shots'):
            roleOverrides = roleOverridesByRoot.get(root)
            if not roleOverrides:
                continue
            tempColumns = [
                col.withRole(roleOverrides[col.key()])
                if col.key() in roleOverrides and col.root() in ('common', root)
                else col
                for col in tempColumns
            ]
        self._columns = sorted(tempColumns, key=lambda c: c.createdAtUtc() or '0')

    def _collectColumns(self, root: str) -> Iterator[Column]:
        for col in self._columns:
            if not col.visibled() or col.root() not in ('common', root):
                continue
            yield col

    def _manageColumns(self):
        currentWidget = self._dataWidgets.get(self._currentRoot)
        cols = [
            col
            for col in self._columns
            if col.root() in ('common', self._currentRoot)
            and col.key() not in READ_ONLY_COLUMN_KEYS
        ]
        dlg = ColumnListDialog(
            self._api,
            self._project.keyName(),
            self._studio.keyName(),
            self._currentRoot,
            cols,
            currentWidget.getColumnOrder() if currentWidget else [],
            self._dataRepo,
            self._state,
            self,
        )
        dlg.exec()
        if dlg.isChanged():
            self._rebuildColumns()
            self._refresh()

    def _manageRoles(self):
        dlg = RoleManagerDialog(self._state, self)
        dlg.exec()

    def _resetTasks(self, root: str | None = None) -> None:
        for path, task in self._thumbnailPathsTasks.items():
            if root is not None and not path.startswith(root + '/'):
                continue
            task.thumbnailPathsLoaded.disconnect(self._loadThumbnailTask)
        self._thumbnailPathsTasks.clear()
        for path, task in self._thumbnailTasks.items():
            if root is not None and not path.startswith(root + '/'):
                continue
            task.thumbnailLoaded.disconnect(self._updateThumbnailLabel)
        self._thumbnailTasks.clear()

    def _updateThumbnailLabel(self, path: str, image: QImage) -> None:
        pathParts = path.split('/')
        if len(pathParts) < 2:
            return
        root = pathParts[0]
        scaledImage = image.scaled(
            90,
            90,
            Qt.AspectRatioMode.KeepAspectRatio,
            Qt.TransformationMode.SmoothTransformation,
        )
        icon = QIcon(QPixmap.fromImage(scaledImage))

        if root in self._thumbnailCache:
            self._thumbnailCache[root][path] = icon

        if path in self._thumbnailTasks:
            self._thumbnailTasks.pop(path)

        widget = self._dataWidgets.get(root)
        if widget is None:
            return

        groupPath = '/'.join(pathParts[1:])
        widget.onThumbnailUpdated(groupPath, icon)

    def _loadThumbnailTask(self, path: str, thumbPaths: ThumbnailPaths) -> None:
        if path not in self._thumbnailPathsTasks:
            return
        self._thumbnailPathsTasks.pop(path)

        pathParts = path.split('/')
        root = pathParts[0]
        if root in self._thumbnailCache and path in self._thumbnailCache[root]:
            widget = self._dataWidgets.get(root)
            if widget is not None:
                groupPath = '/'.join(pathParts[1:])
                widget.onThumbnailUpdated(groupPath, self._thumbnailCache[root][path])
            return

        task = LoadThumbnailTask(
            path,
            thumbPaths,
        )
        task.thumbnailLoaded.connect(self._updateThumbnailLabel)
        self._thumbnailTasks[path] = task
        self._service.threadStart(task)

    def _loadThumbnail(self, root: str | None = None) -> None:
        for value in self._service.iterLatestThumbnailValues():
            if root is not None and not value.location().startswith(root + '/'):
                continue
            groupPath = self._service.valueLocationToGroupPath(value)
            if groupPath is None:
                continue
            _logger.debug('Loading thumbnail for %s', groupPath)
            pathRoot = groupPath.split('/')[0]
            if pathRoot in self._thumbnailCache and groupPath in self._thumbnailCache[pathRoot]:
                widget = self._dataWidgets.get(pathRoot)
                if widget is not None:
                    widgetGroupPath = '/'.join(groupPath.split('/')[1:])
                    widget.onThumbnailUpdated(
                        widgetGroupPath, self._thumbnailCache[pathRoot][groupPath]
                    )  # noqa: E501
                continue

            task = LoadThumbnailPathsTask(
                self._service,
                value,
            )
            task.thumbnailPathsLoaded.connect(self._loadThumbnailTask)
            self._thumbnailPathsTasks[groupPath] = task
            self._service.threadStart(task)

    def changeRootButtonToggled(self, button: QPushButton, checked: bool) -> None:
        if checked:
            root = 'assets' if button == self._assetsButton else 'shots'
            _logger.debug('Root changed to %s', root)
            if root != self._currentRoot:
                self._currentRoot = root
                self._assetsTableWidget.setVisible(root == 'assets')
                self._shotsTreeWidget.setVisible(root == 'shots')


class CheckableButton(QPushButton):
    def __init__(self, text: str, icon: QIcon | None = None, parent: QWidget | None = None) -> None:
        super().__init__(text, parent)
        self.setCheckable(True)
        self.setMinimumWidth(120)

        if icon is not None:
            self.setIcon(icon)


class DataWidget(QWidget):
    GROUPPATH_ROLE = Qt.ItemDataRole.UserRole + 1
    SORT_ROLE = Qt.ItemDataRole.UserRole + 2
    FILTER_ROLE = Qt.ItemDataRole.UserRole + 3

    dataLoaded: Signal = Signal()  # type: ignore

    def __init__(
        self,
        service: Service,
        api: ApiClient,
        state: State,
        columns: list[Column],
        thumbnailCache: dict[str, QIcon],
        root: str,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self._service = service
        self._api = api
        self._state = state
        self._columns = columns
        self._thumbnailCache = thumbnailCache
        self._root = root

        self._vLayout = QVBoxLayout(self)
        self._vLayout.setContentsMargins(0, 0, 0, 0)

        self._model = QStandardItemModel(self)
        self._proxyModel = KeywordFilterProxyModel(self)
        self._proxyModel.setSourceModel(self._model)
        self._proxyModel.setRecursiveFilteringEnabled(True)
        self._proxyModel.setSortRole(self.SORT_ROLE)
        self._proxyModel.setFilterRole(self.FILTER_ROLE)

        self._currentSortKey = 'name'
        self._currentSortDirection = 1
        self._headerMap: list[str] = []
        self._entities: dict[str, Entity | None] = {}

        self._thumbnailItems: dict[str, QStandardItem] = {}
        self._entitiesTask: LoadEntitiesTask | None = None
        self._pendingSelection: list[str] = []

        defaultImg = self._service.defaultThumbnail()
        scaledDefault = defaultImg.scaled(
            90,
            90,
            Qt.AspectRatioMode.KeepAspectRatio,
            Qt.TransformationMode.SmoothTransformation,
        )
        self._defaultThumbnailIcon = QIcon(QPixmap.fromImage(scaledDefault))

    def _getView(self) -> QAbstractItemView:
        raise NotImplementedError

    def _getHorizontalHeader(self) -> QHeaderView:
        raise NotImplementedError

    def _getVisibleColumns(self) -> list[Column]:
        raise NotImplementedError

    def _getTypedValue(self, val: Any, dtype: str) -> Any:
        if val == '' or val is None:
            if dtype == 'int':
                return -999999999
            elif dtype == 'float':
                return -999999999.0
            return ''

        try:
            if dtype == 'int':
                return int(val)
            elif dtype == 'float':
                return float(val)
            elif dtype == 'bool':
                return str(val).lower() in ('true', '1')
        except (ValueError, TypeError):
            if dtype == 'int':
                return -999999999
            elif dtype == 'float':
                return -999999999.0

        return str(val).lower()

    def enableCustomSorting(self):
        header = self._getHorizontalHeader()
        header.setSectionsClickable(True)
        header.setSortIndicatorShown(True)
        header.sectionClicked.connect(self.onHeaderSectionClicked)

    def enableColumnReordering(self):
        header = self._getHorizontalHeader()
        header.setSectionsMovable(True)

        header.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        header.customContextMenuRequested.connect(self.showHeaderContextMenu)

    def showHeaderContextMenu(self, pos: QPoint) -> None:
        menu = QMenu(self)
        saveUserAction = menu.addAction('Save Column Order for User')
        saveProjectAction = menu.addAction('Save Column Order for Project')
        _canSaveProjectOrder = self._state.hasPermission(Permission.CanSaveProjectColumnOrder)
        saveProjectAction.setVisible(_canSaveProjectOrder)
        resetAction = menu.addAction('Reset User Column Order')

        action = menu.exec(self._getHorizontalHeader().mapToGlobal(pos))
        if action == saveUserAction:
            self._onSaveUserColumnOrder()
        elif action == saveProjectAction:
            self._onSaveProjectColumnOrder()
        elif action == resetAction:
            self._onResetColumnOrder()

    def getColumnOrder(self) -> list[str]:
        header = self._getHorizontalHeader()
        orderKeys: list[str] = []
        for visualIdx in range(header.count()):
            logicalIdx = header.logicalIndex(visualIdx)
            if 0 <= logicalIdx < len(self._headerMap):
                orderKeys.append(self._headerMap[logicalIdx])
        return orderKeys

    def _onResetColumnOrder(self) -> None:
        reply = QMessageBox.question(
            self,
            'Confirm Reset',
            'Are you sure you want to reset the data?\nThis action cannot be undone.',
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )
        if reply == QMessageBox.StandardButton.Yes:
            self.saveColumnOrder([], str(Sections.USER), self._root)
            self.refresh()

    def _onSaveUserColumnOrder(self) -> None:
        self.saveColumnOrder(self.getColumnOrder(), str(Sections.USER), self._root)

    def _onSaveProjectColumnOrder(self) -> None:
        self.saveColumnOrder(self.getColumnOrder(), str(Sections.PROJECT), self._root)

    def saveColumnOrder(
        self,
        columnKeys: list[str],
        section: str,
        root: str,
    ) -> None:
        self._state.setColumnOrder(columnKeys, section, root)

    def applyColumnOrder(self, columnKeys: list[str]) -> None:
        if not columnKeys:
            return

        header = self._getHorizontalHeader()
        keyToLogical = {key: i for i, key in enumerate(self._headerMap)}

        header.blockSignals(True)
        try:
            currentVisualIdx = 0
            for key in columnKeys:
                if key in keyToLogical:
                    logicalIdx = keyToLogical[key]
                    oldVisualIdx = header.visualIndex(logicalIdx)
                    if oldVisualIdx != currentVisualIdx:
                        header.moveSection(oldVisualIdx, currentVisualIdx)
                    currentVisualIdx += 1
        finally:
            header.blockSignals(False)

    def getSavedColumnOrder(self, root: str) -> list[str]:
        return self._state.columnOrder(root)

    def onHeaderSectionClicked(self, logicalIndex: int):
        if logicalIndex < 0 or logicalIndex >= len(self._headerMap):
            return

        desc = Qt.SortOrder.DescendingOrder
        asc = Qt.SortOrder.AscendingOrder
        colKey = self._headerMap[logicalIndex]

        if colKey == 'thumbnail':
            if self._currentSortKey in self._headerMap:
                prevIdx = self._headerMap.index(self._currentSortKey)
                prevOrder = asc if self._currentSortDirection == 1 else desc
                self._getHorizontalHeader().setSortIndicator(prevIdx, prevOrder)
                _logger.debug(
                    'Set sort indicator: index=%d, order=%s',
                    prevIdx,
                    'asc' if prevOrder == asc else 'desc',
                )
            return

        header = self._getHorizontalHeader()

        if self._currentSortKey == colKey:
            new_order = desc if self._currentSortDirection == 1 else asc
        else:
            new_order = asc

        self._currentSortKey = colKey
        self._currentSortDirection = 1 if new_order == asc else -1

        header.setSortIndicator(logicalIndex, new_order)
        self._proxyModel.sort(logicalIndex, new_order)
        _logger.debug(
            'Header clicked: index=%d, key=%s, new_order=%s',
            logicalIndex,
            colKey,
            'asc' if new_order == asc else 'desc',
        )

    def setupFilterWidget(self):
        self._filterWidget = QWidget(self)
        self._filterLayout = QHBoxLayout(self._filterWidget)
        self._filterLayout.setContentsMargins(0, 0, 0, 0)
        self._filterSpacer = QSpacerItem(
            1,
            0,
            QSizePolicy.Policy.Expanding,
            QSizePolicy.Policy.Minimum,
        )
        self._filterLabel = QLabel('Filter keyword: ', self)
        self._filterLineEdit = QLineEdit(self)
        self._filterLineEdit.setPlaceholderText('Space separated for AND search')
        palette = self._filterLineEdit.palette()
        placeholderColor = QColor('gray')
        palette.setColor(QPalette.ColorRole.PlaceholderText, placeholderColor)
        self._filterLineEdit.setPalette(palette)
        if hasattr(self._filterLineEdit, 'setClearButtonEnabled'):
            self._filterLineEdit.setClearButtonEnabled(True)
        self._filterLineEdit.textChanged.connect(self._proxyModel.setKeywordFilterPattern)
        self._filterLayout.addItem(self._filterSpacer)
        self._filterLayout.insertWidget(1, self._filterLabel)
        self._filterLayout.insertWidget(2, self._filterLineEdit)
        self._vLayout.insertWidget(0, self._filterWidget)

    def _getGroups(self) -> Iterator[Group]:
        for group in self._service.iterGroups(self._root):
            yield group

    def onThumbnailUpdated(self, group: str, icon: QIcon):
        item = self._thumbnailItems.get(group)
        if item is not None:
            item.setIcon(icon)

    def _canEditColumn(self, column: Column) -> bool:
        # A parameter is editable only when both global permission and column role pass.
        return (
            self._state.hasPermission(Permission.CanEditParameters)
            and self._state.currentRole().value >= column.role().value
        )

    def _editableParameterColumns(self) -> list[Column]:
        editableByKey = {
            col.key(): col
            for col in self._getVisibleColumns()
            if col.key() not in READ_ONLY_COLUMN_KEYS and self._canEditColumn(col)
        }
        orderedColumns = [
            editableByKey.pop(key)
            for key in self.getColumnOrder()
            if key in editableByKey
        ]
        orderedColumns.extend(editableByKey.values())
        return orderedColumns

    def columnForIndex(self, index: QModelIndex) -> Column | None:
        if not index.isValid() or not 0 <= index.column() < len(self._headerMap):
            return None
        key = self._headerMap[index.column()]
        return next((col for col in self._getVisibleColumns() if col.key() == key), None)

    def valueForIndex(self, index: QModelIndex, column: Column) -> Any:
        group = index.data(self.GROUPPATH_ROLE)
        entity = self._entities.get(group)
        if entity is None:
            return ''
        return entity.data().get(column.key(), '')

    def canDirectEditCell(self, index: QModelIndex, showWarning: bool = True) -> bool:
        group = index.data(self.GROUPPATH_ROLE)
        column = self.columnForIndex(index)
        if group is None or column is None:
            return False

        if column.key() in READ_ONLY_COLUMN_KEYS:
            if showWarning:
                QMessageBox.information(
                    self,
                    'Read Only',
                    f'"{column.displayName()}" cannot be edited directly.',
                )
            return False

        if not self._canEditColumn(column):
            if showWarning:
                QMessageBox.information(
                    self,
                    'Permission Denied',
                    (
                        f'"{column.displayName()}" requires '
                        f'{column.roleDisplayName()} role or higher.'
                    ),
                )
            return False

        return True

    def saveDirectCellEdit(self, index: QModelIndex, column: Column, value: Any) -> bool:
        group = index.data(self.GROUPPATH_ROLE)
        if group is None:
            return False

        if not self.canDirectEditCell(index):
            return False

        key = column.key()
        targetGroups = [group]
        changeData = {key: value}

        existingValueGroups: list[str] = []
        for targetGroup in targetGroups:
            entity = self._entities.get(targetGroup)
            oldValue = entity.data().get(key, '') if entity is not None else ''
            if oldValue is not None and str(oldValue) != '' and str(oldValue) != str(value):
                existingValueGroups.append(targetGroup)

        if existingValueGroups:
            if len(existingValueGroups) == 1:
                message = (
                    f'"{column.displayName()}" already has an old value '
                    f'for "{existingValueGroups[0]}".\n\n'
                    'Click Ok to replace the old value with the new value, '
                    'or Cancel to keep the old value.'
                )
            else:
                previewGroups = ', '.join(existingValueGroups[:5])
                if len(existingValueGroups) > 5:
                    previewGroups += f', and {len(existingValueGroups) - 5} more'
                message = (
                    f'"{column.displayName()}" already has old values in '
                    f'{len(existingValueGroups)} selected rows:\n'
                    f'{previewGroups}\n\n'
                    'Click Ok to replace the old values with the new value, '
                    'or Cancel to keep the old values.'
                )
            confirm = QMessageBox.question(
                self,
                'Confirm Replace Values',
                message,
                QMessageBox.StandardButton.Ok | QMessageBox.StandardButton.Cancel,
                QMessageBox.StandardButton.Cancel,
            )
            if confirm != QMessageBox.StandardButton.Ok:
                return False

        updateCount = 0
        try:
            for targetGroup in targetGroups:
                entity = self._entities.get(targetGroup)
                oldValue = entity.data().get(key, '') if entity is not None else ''
                if str(oldValue) == str(value):
                    continue

                if entity is not None:
                    self._api.updateEntity(entity.id(), self._root, targetGroup, changeData)
                else:
                    self._api.createEntity(self._root, targetGroup, changeData)
                self.updateSingleEntity(targetGroup, changeData)
                updateCount += 1
            return True
        except Exception as ex:
            QMessageBox.critical(self, 'Error', str(ex))
            return False

    def beginDirectCellEdit(
        self,
        index: QModelIndex,
    ) -> bool:
        if not self.canDirectEditCell(index):
            return False
        selectionModel = self._getView().selectionModel()
        if selectionModel is not None:
            selectionModel.setCurrentIndex(
                index,
                (
                    QItemSelectionModel.SelectionFlag.ClearAndSelect
                    | QItemSelectionModel.SelectionFlag.Rows
                ),
            )
        self._getView().edit(index)
        return True

    def showCellContextMenu(self, view: QAbstractItemView, pos: QPoint) -> None:
        index = view.indexAt(pos)
        if not index.isValid():
            return

        selectedGroups = self._getSelection()
        clickedGroup = index.data(self.GROUPPATH_ROLE)
        isMultiSelectedClick = clickedGroup in selectedGroups and len(selectedGroups) > 1
        if isMultiSelectedClick:
            return

        menu = QMenu(view)
        editAction = menu.addAction('Edit in Cell')
        editAction.setEnabled(
            self.canDirectEditCell(index, showWarning=False)
        )

        selectedAction = menu.exec(view.viewport().mapToGlobal(pos))
        if selectedAction == editAction:
            self.beginDirectCellEdit(index)

    def onDoubleClick(self, index: QModelIndex):
        group = index.data(self.GROUPPATH_ROLE)
        if group is None:
            return

        editableColumns = self._editableParameterColumns()
        if not editableColumns:
            QMessageBox.information(
                self,
                'Permission Denied',
                'You do not have permission to edit any parameters.',
            )
            return

        if 0 <= index.column() < len(self._headerMap):
            clickedKey = self._headerMap[index.column()]
            clickedColumn = next(
                (col for col in self._columns if col.key() == clickedKey),
                None,
            )
            if (
                clickedColumn is not None
                and clickedColumn.key() not in READ_ONLY_COLUMN_KEYS
                and not self._canEditColumn(clickedColumn)
            ):
                # Block opening the parameter dialog when the clicked column role is higher.
                QMessageBox.information(
                    self,
                    'Permission Denied',
                    (
                        f'"{clickedColumn.displayName()}" requires '
                        f'{clickedColumn.roleDisplayName()} role or higher.'
                    ),
                )
                return

        groups = self._getSelection()
        if group not in groups:
            groups = [group]
        else:
            groups = list(dict.fromkeys(groups))
        entities = [
            entity.asDict() if entity is not None else None
            for entity in (self._entities.get(selectedGroup) for selectedGroup in groups)
        ]
        dlg = EntityEditorDialog(
            self._api,
            self._root,
            groups,
            editableColumns,
            entities,
            self,
            columnOrder=self.getColumnOrder(),
        )
        if dlg.exec() == QDialog.DialogCode.Accepted:
            newRoot, savedGroups, newData = dlg.getSavedInfo()
            if newRoot != self._root:
                self.refresh()
            else:
                for savedGroup in savedGroups:
                    self.updateSingleEntity(savedGroup, newData)

    def _getSelection(self) -> list[str]:
        selectedPaths: list[str] = []
        for index in self._getView().selectionModel().selectedRows():
            path = index.data(self.GROUPPATH_ROLE)
            if path:
                selectedPaths.append(path)
        return selectedPaths

    def _setSelection(self, paths: list[str]) -> None:
        def _searchProxyIndex(parentIdx: QModelIndex):
            for row in range(self._proxyModel.rowCount(parentIdx)):
                idx = self._proxyModel.index(row, 0, parentIdx)
                path = idx.data(self.GROUPPATH_ROLE)
                if path in targetPaths:
                    selectionModel.select(
                        idx,
                        QItemSelectionModel.SelectionFlag.Select
                        | QItemSelectionModel.SelectionFlag.Rows,  # noqa: E501
                    )
                    self._getView().scrollTo(idx)

                if self._proxyModel.hasChildren(idx):
                    _searchProxyIndex(idx)

        if not paths:
            return

        targetPaths = set(paths)
        selectionModel = self._getView().selectionModel()
        selectionModel.clearSelection()

        _searchProxyIndex(QModelIndex())

    def refresh(self, columns: list[Column] | None = None) -> None:
        self._pendingSelection = self._getSelection()
        self.refreshColumns(columns)
        self.refreshData()

    def refreshColumns(self, columns: list[Column] | None = None) -> None:
        if columns is not None:
            self._columns = columns

        visible_cols = self._getVisibleColumns()
        displayColumns = [col.displayName() for col in visible_cols]

        self._model.setColumnCount(len(displayColumns))
        self._model.setHorizontalHeaderLabels(displayColumns)
        self._headerMap = [col.key() for col in visible_cols]

    def exportCsv(self) -> None:
        filePath, _ = QFileDialog.getSaveFileName(
            self,
            'Export CSV',
            '',
            'CSV Files (*.csv)',
        )
        if not filePath:
            return

        try:
            _logger.debug('Exporting CSV to %s', filePath)
            with open(filePath, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)

                # Header
                headers = [
                    col.key()
                    for col in self._columns
                    if col.visibled() and col.key() != 'thumbnail'
                ]  # noqa: E501
                writer.writerow(headers)

                # Data
                allGroups = [grp.keyName() for grp in self._getGroups()]
                sortedKeys = sorted(allGroups)

                for key in sortedKeys:
                    entity = self._entities.get(key)

                    row: list[str] = []
                    for col in self._columns:
                        if not col.visibled() or col.key() == 'thumbnail':
                            continue

                        colKey = col.key()
                        if colKey in GENERATED_COLUMN_KEYS:
                            row.append(self._getGeneratedValue(colKey, key))
                        elif colKey == 'name':
                            row.append(key)
                        else:
                            val = ''
                            if entity:
                                val = entity.data().get(colKey, '')
                            row.append(str(val))
                    writer.writerow(row)

            _logger.debug('CSV export completed: %s', filePath)
            QMessageBox.information(self, 'Success', f'Exported to {filePath}')

        except Exception as e:
            _logger.exception('Error exporting CSV')
            QMessageBox.critical(self, 'Error', str(e))

    def _validateImportValue(self, value: str | Any, column: Column) -> str | None:
        dtype = column.dataType()

        if not value:
            return None

        if dtype == 'int':
            try:
                int(value)
                return 'valid'
            except ValueError:
                return 'error'
        elif dtype == 'float':
            try:
                float(value)
                return 'valid'
            except ValueError:
                return 'error'
        elif dtype == 'bool':
            if str(value).lower() in ('true', 'false', '0', '1'):
                return 'valid'
            return 'error'
        elif dtype == 'array':
            options = column.config().get('options', [])
            isMulti = column.config().get('multi_select', False)
            if isMulti:
                vals = [v.strip() for v in str(value).split(',')]
                for v in vals:
                    if v and v not in options:
                        return 'warning'
            else:
                if str(value) not in options:
                    return 'warning'
        return 'valid'

    def importCsv(self) -> None:
        filePath, _ = QFileDialog.getOpenFileName(
            self,
            'Import CSV',
            '',
            'CSV Files (*.csv)',
        )
        if not filePath:
            return

        try:
            _logger.debug('Importing CSV from %s', filePath)
            changes: list[CsvEntityData] = []
            validGroups = {grp.keyName() for grp in self._getGroups()}
            columnMap = {c.key(): c for c in self._columns}
            with open(filePath, 'r', newline='', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)

                if reader.fieldnames is not None and 'name' not in reader.fieldnames:
                    raise ValueError('CSV must have a "name" column to identify entities.')

                csvHeaders = reader.fieldnames
                if csvHeaders is None:
                    raise ValueError('CSV file is empty or invalid.')
                validKeys = {col.key() for col in self._columns}
                # Filter out read-only columns from the display columns
                # This ensures that only editable columns are considered for import
                displayColumns = [
                    h for h in csvHeaders if h in validKeys and h not in READ_ONLY_COLUMN_KEYS
                ]

                for row in reader:
                    name = row.get('name')
                    if not name or name not in validGroups:
                        continue

                    dataEntity = self._entities.get(name)
                    isNew = False
                    if dataEntity is None:
                        isNew = True
                        _logger.debug('Creating new entity for %s', name)
                        # Add an entity without updating the UI
                        dataEntity = Entity('', '', self._root, name, {}, '', '', '', '', '0')

                    entityChanges: dict[str, dict[str, str | Any]] = {}

                    for colKey in displayColumns:
                        column = columnMap.get(colKey)
                        if column is None:
                            continue

                        newVal = row.get(colKey)
                        if newVal is None:
                            continue
                        currentVal = dataEntity.data().get(colKey, '')
                        if str(currentVal) != str(newVal):
                            status = self._validateImportValue(newVal, column)
                            if status is None:
                                continue
                            entityChanges[colKey] = {
                                'value': newVal,
                                'status': status,
                            }

                    if entityChanges:
                        _logger.debug('Changes detected for entity %s: %s', name, entityChanges)
                        changes.append(
                            CsvEntityData(
                                entity=dataEntity,
                                changes=entityChanges,
                                isNew=isNew,
                            )
                        )

            if not changes:
                _logger.debug('No changes detected in CSV import.')
                QMessageBox.information(self, 'Info', 'No changes detected.')
                return

            dlg = ConfirmImportDialog(changes, displayColumns, self)
            if dlg.exec() == QDialog.DialogCode.Accepted:
                updateCount = 0
                for item in changes:
                    entity: Entity = item['entity']
                    rawChanges: dict[str, dict[str, str | Any]] = item['changes']
                    isNew: bool = item.get('isNew', False)

                    changeData: dict[str, str | Any] = {}
                    for key, val in rawChanges.items():
                        rawVal = val.get('value')
                        if val.get('status') == 'valid' and rawVal:
                            changeData[key] = rawVal
                    if not changeData:
                        continue

                    if isNew:
                        self._api.createEntity(
                            entity.root(),
                            entity.group(),
                            changeData,
                        )
                    else:
                        self._api.updateEntity(
                            entity.id(),
                            entity.root(),
                            entity.group(),
                            changeData,
                        )
                    self.updateSingleEntity(entity.group(), changeData)
                    updateCount += 1

                if updateCount > 0:
                    _logger.debug('%d entities updated/created.', updateCount)
                    QMessageBox.information(
                        self,
                        'Success',
                        f'{updateCount} entities updated/created.',
                    )
                else:
                    _logger.debug('No valid data to update.')
                    QMessageBox.warning(self, 'Warning', 'No valid data to update.')

        except Exception as e:
            QMessageBox.critical(self, 'Error', str(e))

    def updateSingleEntity(self, group: str, data: dict[str, Any]) -> None:
        raise NotImplementedError

    def refreshData(self) -> None:
        task = LoadEntitiesTask(
            self._api,
            self._root,
            self._currentSortKey,
            self._currentSortDirection,
        )
        task.entitiesLoaded.connect(self._onEntitiesLoaded)
        self._entitiesTask = task
        self._service.threadStart(task)

    def _onEntitiesLoaded(self, root: str, rawEntities: list[Any]) -> None:
        if root != self._root:
            return
        self._entitiesTask = None
        self._applyEntities(rawEntities)
        self._setSelection(self._pendingSelection)
        self._pendingSelection = []
        self.dataLoaded.emit()

    def _applyEntities(self, rawEntities: list[Any]) -> None:
        raise NotImplementedError

    def _getGeneratedValue(self, colKey: str, group: str) -> str:
        if self._root == 'shots' and colKey == 'cut_number':
            parts = [part for part in group.split('/') if part]
            if len(parts) >= 3:
                return '_'.join(parts)
        return ''


class TableWidget(DataWidget):
    def __init__(
        self,
        service: Service,
        api: ApiClient,
        state: State,
        columns: list[Column],
        thumbnailCache: dict[str, QIcon],
        root: str,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(service, api, state, columns, thumbnailCache, root, parent)

        self._tableWidget = QTableView(self)
        self._tableWidget.setAlternatingRowColors(True)
        self._tableWidget.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self._tableWidget.setSelectionMode(QAbstractItemView.SelectionMode.ExtendedSelection)
        self._tableWidget.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self._tableWidget.verticalHeader().setDefaultSectionSize(70)
        self._tableWidget.setIconSize(QSize(90, 90))
        self._tableWidget.setModel(self._proxyModel)
        self._tableWidget.setItemDelegate(InlineCellEditDelegate(self, self._tableWidget))
        self._vLayout.addWidget(self._tableWidget)

        # Keep Thumbnail and Name visible while scrolling horizontally.
        self._frozenColumnsTableWidget = QTableView(self._tableWidget)
        self._frozenColumnsTableWidget.setModel(self._proxyModel)
        self._frozenColumnsTableWidget.setSelectionModel(self._tableWidget.selectionModel())
        self._frozenColumnsTableWidget.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self._frozenColumnsTableWidget.setAlternatingRowColors(True)
        self._frozenColumnsTableWidget.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self._frozenColumnsTableWidget.setIconSize(QSize(90, 90))
        self._frozenColumnsTableWidget.setSelectionMode(
            QAbstractItemView.SelectionMode.ExtendedSelection
        )
        self._frozenColumnsTableWidget.setSelectionBehavior(
            QAbstractItemView.SelectionBehavior.SelectRows
        )
        self._frozenColumnsTableWidget.verticalHeader().setDefaultSectionSize(70)
        self._frozenColumnsTableWidget.verticalHeader().hide()
        self._frozenColumnsTableWidget.horizontalHeader().setSectionsClickable(False)
        self._frozenColumnsTableWidget.horizontalHeader().setSortIndicatorShown(False)
        self._frozenColumnsTableWidget.horizontalScrollBar().hide()
        self._frozenColumnsTableWidget.verticalScrollBar().hide()
        self._frozenColumnsTableWidget.setHorizontalScrollBarPolicy(
            Qt.ScrollBarPolicy.ScrollBarAlwaysOff
        )
        self._frozenColumnsTableWidget.setVerticalScrollBarPolicy(
            Qt.ScrollBarPolicy.ScrollBarAlwaysOff
        )
        self._tableWidget.viewport().installEventFilter(self)
        self._tableWidget.horizontalHeader().sectionResized.connect(
            self._updateFrozenColumns
        )
        self._tableWidget.verticalScrollBar().valueChanged.connect(
            self._frozenColumnsTableWidget.verticalScrollBar().setValue
        )
        self._frozenColumnsTableWidget.verticalScrollBar().valueChanged.connect(
            self._tableWidget.verticalScrollBar().setValue
        )
        self._tableWidget.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self._tableWidget.customContextMenuRequested.connect(
            lambda pos: self.showCellContextMenu(self._tableWidget, pos)
        )
        self._frozenColumnsTableWidget.setContextMenuPolicy(
            Qt.ContextMenuPolicy.CustomContextMenu
        )
        self._frozenColumnsTableWidget.customContextMenuRequested.connect(
            lambda pos: self.showCellContextMenu(self._frozenColumnsTableWidget, pos)
        )

        self.setupFilterWidget()
        self.enableCustomSorting()
        self.enableColumnReordering()
        self._tableWidget.doubleClicked.connect(self.onDoubleClick)
        self._frozenColumnsTableWidget.doubleClicked.connect(self.onDoubleClick)

    def eventFilter(self, watched: QWidget, event: QEvent) -> bool:
        if watched == self._tableWidget.viewport() and event.type() == QEvent.Type.Resize:
            self._updateFrozenColumns()
        return super().eventFilter(watched, event)

    def _getView(self) -> QTableView:
        return self._tableWidget

    def _getHorizontalHeader(self) -> QHeaderView:
        return self._tableWidget.horizontalHeader()

    def _getVisibleColumns(self) -> list[Column]:
        return [col for col in self._columns if col.visibled()]

    def refreshColumns(self, columns: list[Column] | None = None) -> None:
        super().refreshColumns(columns)

        header = self._getHorizontalHeader()
        if header.count() > 1:
            header.setSectionResizeMode(1, QHeaderView.ResizeMode.Interactive)
            self._tableWidget.setColumnWidth(1, 150)
        self._updateFrozenColumns()

    def _updateFrozenColumns(self) -> None:
        # Mirror only the first two columns and place them over the scrolling table viewport.
        frozenColumnCount = min(2, self._proxyModel.columnCount())
        if frozenColumnCount == 0:
            self._frozenColumnsTableWidget.hide()
            return

        for col in range(self._proxyModel.columnCount()):
            self._frozenColumnsTableWidget.setColumnHidden(col, col >= frozenColumnCount)

        frozenWidth = 0
        for col in range(frozenColumnCount):
            columnWidth = self._tableWidget.columnWidth(col)
            self._frozenColumnsTableWidget.setColumnWidth(col, columnWidth)
            frozenWidth += columnWidth

        self._frozenColumnsTableWidget.setFixedWidth(frozenWidth)
        self._frozenColumnsTableWidget.setFixedHeight(
            self._tableWidget.viewport().height()
            + self._tableWidget.horizontalHeader().height()
        )
        self._frozenColumnsTableWidget.move(
            self._tableWidget.verticalHeader().width() + self._tableWidget.frameWidth(),
            self._tableWidget.frameWidth(),
        )
        self._frozenColumnsTableWidget.show()
        self._frozenColumnsTableWidget.raise_()

    def updateSingleEntity(self, group: str, data: dict[str, Any]) -> None:
        entity = self._entities.get(group)
        if entity is not None:
            entity.data().update(data)
        else:
            # Create local cache if not exists (for new entities)
            # We don't have full server info (ID etc) but enough for display
            self._entities[group] = Entity('', '', self._root, group, data, '', '', '', '', '0')

        for row in range(self._model.rowCount()):
            index = self._model.index(row, 0)
            if index.data(self.GROUPPATH_ROLE) == group:
                for colIdx, column in enumerate(self._getVisibleColumns()):
                    key = column.key()
                    if key in READ_ONLY_COLUMN_KEYS:
                        continue
                    if key in data:
                        item = self._model.itemFromIndex(self._model.index(row, colIdx))
                        if item:
                            val = data.get(key, '')
                            item.setText(str(val))
                            item.setToolTip(str(val))
                            item.setData(
                                self._getTypedValue(val, column.dataType()),
                                self.SORT_ROLE,
                            )
                break

    def _applyEntities(self, rawEntities: list[Any]) -> None:
        self._entities = {
            ent.get('group'): Entity.fromDict(ent) for ent in rawEntities if ent.get('group')
        }  # noqa: E501

        groupKeyNames = [grp.keyName() for grp in self._getGroups()]
        self._model.removeRows(0, self._model.rowCount())
        self._thumbnailItems.clear()
        visible_cols = self._getVisibleColumns()

        for ent in groupKeyNames:
            _entity = self._entities.get(ent)
            items: list[QStandardItem] = []
            for column in visible_cols:
                item = QStandardItem()
                item.setSizeHint(QSize(0, 70))
                item.setData(ent, self.GROUPPATH_ROLE)
                item.setData(ent, self.FILTER_ROLE)

                if column.key() == 'thumbnail':
                    cacheKey = f'{self._root}/{ent}'
                    icon = self._thumbnailCache.get(cacheKey, self._defaultThumbnailIcon)
                    item.setIcon(icon)
                    # 高速アクセスのために辞書に登録
                    self._thumbnailItems[ent] = item
                    item.setData('', self.SORT_ROLE)
                elif column.key() == 'name':
                    item.setText(str(ent))
                    item.setData(str(ent).lower(), self.SORT_ROLE)
                else:
                    val = _entity.data().get(column.key(), '') if _entity is not None else ''
                    item.setText(str(val))
                    item.setToolTip(str(val))
                    item.setData(self._getTypedValue(val, column.dataType()), self.SORT_ROLE)
                items.append(item)
            if items:
                self._model.appendRow(items)

        if self._currentSortKey in self._headerMap:
            colIdx = self._headerMap.index(self._currentSortKey)
            order = (
                Qt.SortOrder.AscendingOrder
                if self._currentSortDirection == 1
                else Qt.SortOrder.DescendingOrder
            )  # noqa: E501
            self._getHorizontalHeader().setSortIndicator(colIdx, order)
            self._proxyModel.sort(colIdx, order)


class TreeWidget(DataWidget):
    def __init__(
        self,
        service: Service,
        api: ApiClient,
        state: State,
        columns: list[Column],
        thumbnailCache: dict[str, QIcon],
        root: str,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(service, api, state, columns, thumbnailCache, root, parent)

        self._treeWidget = QTreeView(self)
        self._treeWidget.setAlternatingRowColors(True)
        treeStyleSheet = (
            'QTreeView::branch:has-siblings:!adjoins-item {\n'
            '    border-image: none;\n'
            '}\n'
            'QTreeView::branch:has-siblings:adjoins-item {\n'
            '    border-image: none;\n'
            '}\n'
            'QTreeView::branch:!has-children:!has-siblings:adjoins-item {\n'
            '    border-image: none;\n'
            '}\n'
            'QTreeView::branch:has-children:!has-siblings:closed,\n'
            'QTreeView::branch:closed:has-children:has-siblings {\n'
            '    border-image: none;\n'
            '    image: url(:/angle-right.png);\n'
            '}\n'
            'QTreeView::branch:open:has-children:!has-siblings,\n'
            'QTreeView::branch:open:has-children:has-siblings {\n'
            '    border-image: none;\n'
            '    image: url(:/angle-down.png);\n'
            '}'
        )
        self._treeWidget.setStyleSheet(treeStyleSheet)
        self._treeWidget.setIconSize(QSize(90, 90))
        self._treeWidget.setModel(self._proxyModel)
        self._treeWidget.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self._treeWidget.setSelectionMode(QAbstractItemView.SelectionMode.ExtendedSelection)
        self._treeWidget.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self._treeWidget.setItemDelegate(InlineCellEditDelegate(self, self._treeWidget))
        self._vLayout.addWidget(self._treeWidget)

        # Keep Thumbnail and Name visible while scrolling horizontally.
        self._frozenColumnsTreeWidget = QTreeView(self._treeWidget)
        self._frozenColumnsTreeWidget.setModel(self._proxyModel)
        self._frozenColumnsTreeWidget.setSelectionModel(self._treeWidget.selectionModel())
        self._frozenColumnsTreeWidget.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self._frozenColumnsTreeWidget.setAlternatingRowColors(True)
        self._frozenColumnsTreeWidget.setStyleSheet(treeStyleSheet)
        self._frozenColumnsTreeWidget.setIconSize(QSize(90, 90))
        self._frozenColumnsTreeWidget.setEditTriggers(
            QAbstractItemView.EditTrigger.NoEditTriggers
        )
        self._frozenColumnsTreeWidget.setSelectionMode(
            QAbstractItemView.SelectionMode.ExtendedSelection
        )
        self._frozenColumnsTreeWidget.setSelectionBehavior(
            QAbstractItemView.SelectionBehavior.SelectRows
        )
        self._frozenColumnsTreeWidget.header().setSectionsClickable(False)
        self._frozenColumnsTreeWidget.header().setSortIndicatorShown(False)
        self._frozenColumnsTreeWidget.horizontalScrollBar().hide()
        self._frozenColumnsTreeWidget.verticalScrollBar().hide()
        self._frozenColumnsTreeWidget.setHorizontalScrollBarPolicy(
            Qt.ScrollBarPolicy.ScrollBarAlwaysOff
        )
        self._frozenColumnsTreeWidget.setVerticalScrollBarPolicy(
            Qt.ScrollBarPolicy.ScrollBarAlwaysOff
        )
        self._treeWidget.viewport().installEventFilter(self)
        self._treeWidget.header().sectionResized.connect(
            lambda *_: self._updateFrozenColumns()
        )
        self._treeWidget.header().sectionMoved.connect(
            lambda *_: self._updateFrozenColumns()
        )
        self._treeWidget.horizontalScrollBar().valueChanged.connect(
            lambda *_: self._updateFrozenColumns()
        )
        self._treeWidget.verticalScrollBar().valueChanged.connect(
            self._frozenColumnsTreeWidget.verticalScrollBar().setValue
        )
        self._frozenColumnsTreeWidget.verticalScrollBar().valueChanged.connect(
            self._treeWidget.verticalScrollBar().setValue
        )
        self._treeWidget.expanded.connect(self._frozenColumnsTreeWidget.expand)
        self._treeWidget.collapsed.connect(self._frozenColumnsTreeWidget.collapse)
        self._frozenColumnsTreeWidget.expanded.connect(self._treeWidget.expand)
        self._frozenColumnsTreeWidget.collapsed.connect(self._treeWidget.collapse)
        self._treeWidget.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self._treeWidget.customContextMenuRequested.connect(
            lambda pos: self.showCellContextMenu(self._treeWidget, pos)
        )
        self._frozenColumnsTreeWidget.setContextMenuPolicy(
            Qt.ContextMenuPolicy.CustomContextMenu
        )
        self._frozenColumnsTreeWidget.customContextMenuRequested.connect(
            lambda pos: self.showCellContextMenu(self._frozenColumnsTreeWidget, pos)
        )

        self.setupFilterWidget()
        self.enableCustomSorting()
        self.enableColumnReordering()
        self._treeWidget.doubleClicked.connect(self.onDoubleClick)
        self._frozenColumnsTreeWidget.doubleClicked.connect(self.onDoubleClick)

    def eventFilter(self, watched: QWidget, event: QEvent) -> bool:
        if watched == self._treeWidget.viewport() and event.type() == QEvent.Type.Resize:
            self._updateFrozenColumns()
        return super().eventFilter(watched, event)

    def _getView(self) -> QTreeView:
        return self._treeWidget

    def _getHorizontalHeader(self) -> QHeaderView:
        return self._treeWidget.header()

    def _buildColumns(self) -> list[Column]:
        _columns: list[Column] = []
        nameColumn = None
        thumbnailColumn = None
        cutNumberColumn = None
        for col in self._columns:
            if not col.visibled():
                continue
            if col.key() == 'name':
                nameColumn = col
                continue
            if col.key() == 'thumbnail':
                thumbnailColumn = col
                continue
            if col.key() == 'cut_number':
                cutNumberColumn = col
                continue
            _columns.append(col)
        if nameColumn is not None:
            _columns.insert(0, nameColumn)
        if thumbnailColumn is not None:
            _columns.insert(1, thumbnailColumn)
        if cutNumberColumn is not None:
            _columns.insert(2, cutNumberColumn)
        return _columns

    def _getVisibleColumns(self) -> list[Column]:
        return self._buildColumns()

    def refreshColumns(self, columns: list[Column] | None = None) -> None:
        super().refreshColumns(columns)

        header = self._getHorizontalHeader()
        if header.count() > 0:
            header.setSectionResizeMode(0, QHeaderView.ResizeMode.Interactive)
            self._treeWidget.setColumnWidth(0, 150)

        _columns = self._getVisibleColumns()
        if (
            len(_columns) >= 2
            and _columns[0].key() == 'name'
            and _columns[1].key() == 'thumbnail'
        ):
            # Ensure the 'thumbnail' column is visually before the 'name' column,
            # using current visual indices to avoid flip-flopping on repeated calls.
            nameLogical = 0
            thumbnailLogical = 1
            nameVisual = header.visualIndex(nameLogical)
            thumbnailVisual = header.visualIndex(thumbnailLogical)
            if nameVisual != -1 and thumbnailVisual != -1 and nameVisual < thumbnailVisual:
                header.moveSection(nameVisual, thumbnailVisual)
            self._syncFrozenColumnVisualOrder()

        self._updateFrozenColumns()

    def _syncFrozenColumnVisualOrder(self) -> None:
        sourceHeader = self._treeWidget.header()
        frozenHeader = self._frozenColumnsTreeWidget.header()
        frozenHeader.blockSignals(True)
        try:
            for visualIdx in range(sourceHeader.count()):
                logicalIdx = sourceHeader.logicalIndex(visualIdx)
                frozenVisualIdx = frozenHeader.visualIndex(logicalIdx)
                if frozenVisualIdx != -1 and frozenVisualIdx != visualIdx:
                    frozenHeader.moveSection(frozenVisualIdx, visualIdx)
        finally:
            frozenHeader.blockSignals(False)

    def _updateFrozenColumns(self) -> None:
        self._syncFrozenColumnVisualOrder()
        frozenColumns = [
            idx
            for idx, key in enumerate(self._headerMap)
            if key in ('thumbnail', 'name')
        ]
        if not frozenColumns:
            self._frozenColumnsTreeWidget.hide()
            return

        for col in range(self._proxyModel.columnCount()):
            self._frozenColumnsTreeWidget.setColumnHidden(col, col not in frozenColumns)

        frozenWidth = 0
        for col in sorted(frozenColumns, key=self._treeWidget.header().visualIndex):
            columnWidth = self._treeWidget.columnWidth(col)
            self._frozenColumnsTreeWidget.setColumnWidth(col, columnWidth)
            frozenWidth += columnWidth

        self._frozenColumnsTreeWidget.horizontalScrollBar().setValue(0)
        self._frozenColumnsTreeWidget.setFixedWidth(frozenWidth)
        self._frozenColumnsTreeWidget.setFixedHeight(
            self._treeWidget.viewport().height() + self._treeWidget.header().height()
        )
        self._frozenColumnsTreeWidget.move(
            self._treeWidget.frameWidth(),
            self._treeWidget.frameWidth(),
        )
        self._frozenColumnsTreeWidget.show()
        self._frozenColumnsTreeWidget.raise_()

    def updateSingleEntity(self, group: str, data: dict[str, Any]) -> None:
        def _updateRecursively(parentItem: QStandardItem):
            for row in range(parentItem.rowCount()):
                child = parentItem.child(row, 0)
                if child and child.data(self.GROUPPATH_ROLE) == group:
                    for colIdx, column in enumerate(self._getVisibleColumns()):
                        key = column.key()
                        if key in READ_ONLY_COLUMN_KEYS:
                            continue
                        if key in data:
                            sibling = parentItem.child(row, colIdx)
                            if sibling:
                                val = data.get(key, '')
                                sibling.setText(str(val))
                                sibling.setToolTip(str(val))
                                typed_val = self._getTypedValue(val, column.dataType())
                                sibling.setData(typed_val, self.SORT_ROLE)
                    return True
                if child and child.hasChildren():
                    if _updateRecursively(child):
                        return True
            return False

        entity = self._entities.get(group)
        if entity is not None:
            entity.data().update(data)
        else:
            # Create local cache if not exists (for new entities)
            # We don't have full server info (ID etc) but enough for display
            self._entities[group] = Entity('', '', self._root, group, data, '', '', '', '', '0')

        _updateRecursively(self._model.invisibleRootItem())

    def _applyEntities(self, rawEntities: list[Any]) -> None:
        self._entities = {
            ent.get('group'): Entity.fromDict(ent) for ent in rawEntities if ent.get('group')
        }  # noqa: E501

        groupKeyNames = [grp.keyName() for grp in self._getGroups()]
        self._model.removeRows(0, self._model.rowCount())
        self._thumbnailItems.clear()
        visibleCols = self._getVisibleColumns()

        def _findChildByName(parentItem: QStandardItem, name: str) -> QStandardItem | None:
            for row in range(parentItem.rowCount()):
                child = parentItem.child(row, 0)
                if child and child.text() == name:
                    return child
            return None

        for groupKey in groupKeyNames:
            _entity = self._entities.get(groupKey)
            groupKeyParts = groupKey.split('/')
            currentParent = self._model.invisibleRootItem()

            for idx, part in enumerate(groupKeyParts):
                childItem = _findChildByName(currentParent, part)
                if childItem is not None:
                    currentParent = childItem
                else:
                    items = [QStandardItem() for _ in visibleCols]
                    items[0].setText(part)
                    items[0].setData(part.lower(), self.SORT_ROLE)
                    partPath = '/'.join(groupKeyParts[: idx + 1])
                    items[0].setToolTip(partPath)
                    items[0].setData(partPath, self.FILTER_ROLE)
                    currentParent.appendRow(items)
                    currentParent = items[0]

                if idx == len(groupKeyParts) - 1:
                    currentParent.setSizeHint(QSize(0, 70))

            parentOfCurrent = currentParent.parent() or self._model.invisibleRootItem()
            rowIdx = currentParent.row()

            for colIdx, colDef in enumerate(visibleCols):
                item = parentOfCurrent.child(rowIdx, colIdx)
                if not item:
                    continue
                item.setSizeHint(QSize(0, 70))
                item.setData(groupKey, self.GROUPPATH_ROLE)
                item.setData(groupKey, self.FILTER_ROLE)

                if colDef.key() == 'name':
                    pass
                elif colDef.key() == 'thumbnail':
                    cacheKey = f'{self._root}/{groupKey}'
                    icon = self._thumbnailCache.get(cacheKey, self._defaultThumbnailIcon)
                    item.setIcon(icon)
                    self._thumbnailItems[groupKey] = item
                    item.setData('', self.SORT_ROLE)
                    item.setData('', self.FILTER_ROLE)
                elif colDef.key() == 'cut_number':
                    val = self._getGeneratedValue(colDef.key(), groupKey)
                    item.setText(val)
                    item.setToolTip(val)
                    item.setData(val.lower(), self.SORT_ROLE)
                else:
                    val = _entity.data().get(colDef.key(), '') if _entity is not None else ''
                    item.setText(str(val))
                    item.setToolTip(str(val))
                    item.setData(self._getTypedValue(val, colDef.dataType()), self.SORT_ROLE)
                    item.setData(str(val), self.FILTER_ROLE)

        self._treeWidget.expandAll()
        self._frozenColumnsTreeWidget.expandAll()

        if self._currentSortKey in self._headerMap:
            colIdx = self._headerMap.index(self._currentSortKey)
            order = (
                Qt.SortOrder.AscendingOrder
                if self._currentSortDirection == 1
                else Qt.SortOrder.DescendingOrder
            )  # noqa: E501
            self._getHorizontalHeader().setSortIndicator(colIdx, order)
            self._proxyModel.sort(colIdx, order)
