import csv

from ppui.PySide.QtCore import QModelIndex # noqa: F401
from ppui.PySide.QtCore import Qt
from ppui.PySide.QtWidgets import (
    QAbstractItemView,
    QComboBox,
    QCheckBox,
    QDialog,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox, # noqa: F401
    QPushButton,
    QSizePolicy,
    QSpacerItem,
    QTableWidgetItem,
    QTableWidget,
    QVBoxLayout,
    QWidget,
) 

from .apiClient import ApiClient
from .centralClient import Sections
from .state import State
from .tableData import DataRepository
from .tableData import Column
from .userRole import Permission, Role, RoleManager


class CsvDropArea(QLabel):
    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self._dropHandler = None
        self.setAcceptDrops(True)
        self.setAlignment(Qt.AlignCenter)
        self.setMinimumHeight(56)
        self.setText('Drop CSV file here to import Options')
        self.setStyleSheet(
            'QLabel {'
            'border: 1px dashed #808080;'
            'border-radius: 4px;'
            'padding: 8px;'
            'color: #606060;'
            'background-color: #fafafa;'
            '}'
        )

    def setDropHandler(self, handler):
        self._dropHandler = handler

    def dragEnterEvent(self, event):
        # Accept drag only when at least one local CSV file is present.
        if self._hasCsvFile(event):
            event.acceptProposedAction()
        else:
            event.ignore()

    def dropEvent(self, event):
        # Emit the first valid local CSV path and ignore non-CSV drops.
        for url in event.mimeData().urls():
            if not url.isLocalFile():
                continue
            path = url.toLocalFile()
            if path.lower().endswith('.csv'):
                if self._dropHandler is not None:
                    self._dropHandler(path)
                event.acceptProposedAction()
                return
        event.ignore()

    def _hasCsvFile(self, event) -> bool:
        mimeData = event.mimeData()
        if not mimeData.hasUrls():
            return False

        return any(
            url.isLocalFile() and url.toLocalFile().lower().endswith('.csv')
            for url in mimeData.urls()
        )


class ColumnEditDialog(QDialog):
    def __init__(
        self,
        api: ApiClient,
        root: str,
        keys: list[str],
        dataRepository: DataRepository,
        roleManager: RoleManager,
        column: Column | None = None,
        parent: QWidget | None = None,
    ):
        super().__init__(parent)
        self._api = api
        self._root = root
        self._existingKeys = keys
        self._dataRepo = dataRepository
        self._roleManager = roleManager
        self._column = column
        self._savedColumnKey: str | None = None
        self.setWindowTitle('Edit Column' if column else 'Add Column')
        self._layout = QFormLayout(self)

        self.nameEdit = QLineEdit()
        self.keyEdit = QLineEdit()
        self.keyEdit.setEnabled(False)
        self.typeCombo = QComboBox()
        self.typeCombo.addItems(
            [
                'string (ex: text)',
                'int (ex: 10)',
                'float (ex: 0.5)',
                'date (ex: 2025-01-01)',
                'bool (ex: True/False)',
                'array (ex: Select List)',
            ]
        )
        self.roleCombo = QComboBox()
        for role in Role:
            self.roleCombo.addItem(role.displayName, role.keyName)
        self.roleCombo.setCurrentIndex(self.roleCombo.findData(Role.Supervisor.keyName))
        self.optionsEdit = QLineEdit()
        self.optionsEdit.setPlaceholderText('Comma separated for array type')
        self.optionsCsvDropArea = CsvDropArea()
        self.multiSelectChk = QCheckBox('Multi Select (Array only)')
        self.visibleChk = QCheckBox('Visible')
        self.visibleChk.setChecked(True)

        self.systemChk = QCheckBox('Is System Column? (Forced Global)')
        self.globalChk = QCheckBox('Is Global Column?')
        self.excludeEdit = QLineEdit()
        self.excludeEdit.setPlaceholderText('Exclude Projects (comma separated)')
        self.excludeEdit.setEnabled(False)

        if self._column:
            self.nameEdit.setText(self._column.displayName())
            self.keyEdit.setText(self._column.key())
            self.keyEdit.setReadOnly(True)

            dtype = self._column.dataType()
            for i in range(self.typeCombo.count()):
                if self.typeCombo.itemText(i).startswith(dtype):
                    self.typeCombo.setCurrentIndex(i)
                    break

            roleIndex = self.roleCombo.findData(self._column.roleKey())
            if roleIndex != -1:
                self.roleCombo.setCurrentIndex(roleIndex)

            opts = self._column.config().get('options', [])
            self.optionsEdit.setText(', '.join(opts))
            self.multiSelectChk.setChecked(self._column.config().get('multi_select', False))
            self.visibleChk.setChecked(self._column.visibled())

            isSys = self._column.isSystem()
            self.systemChk.setChecked(isSys)

            isGlob = self._column.scope() == 'global'
            self.globalChk.setChecked(isGlob)

            excl = self._column.excludeProjects()
            if excl:
                self.excludeEdit.setText(', '.join(excl))
                self.excludeEdit.setEnabled(True)

            if isSys:
                self.globalChk.setEnabled(False)
                self.excludeEdit.setEnabled(False)

        self._layout.addRow('Display Name:', self.nameEdit)
        self._layout.addRow('Key (Unique):', self.keyEdit)
        self._layout.addRow('Data Type:', self.typeCombo)
        self._layout.addRow('Options (if array):', self.optionsEdit)
        self._layout.addRow('', self.optionsCsvDropArea)
        self._layout.addRow('', self.multiSelectChk)
        self._layout.addRow('', self.visibleChk)
        self._layout.addRow('', self.systemChk)
        self._layout.addRow('', self.globalChk)
        self._layout.addRow('Exclude Projects:', self.excludeEdit)
        self._layout.addRow('Role:', self.roleCombo)

        self.saveBtn = QPushButton('Save' if self._column else 'Create')
        self._layout.addRow(self.saveBtn)

        self.nameEdit.textEdited.connect(self.onDisplayNameEdited)
        self.typeCombo.currentIndexChanged.connect(self.onDataTypeChanged)
        self.optionsEdit.textEdited.connect(self.onOptionsChanged)
        self.optionsCsvDropArea.setDropHandler(self.onOptionsCsvDropped)
        self.systemChk.toggled.connect(self.onSystemToggled)
        self.globalChk.toggled.connect(self.onGlobalToggled)
        self.saveBtn.clicked.connect(self.onSave)

        self.onDataTypeChanged(self.typeCombo.currentIndex())
        self.onOptionsChanged()

    def savedColumnKey(self) -> str | None:
        return self._savedColumnKey

    def _generateUniqueKey(self, userInput: str, existingList: list[str]) -> str:
        parts = [part.strip().lower() for part in userInput.split(' ') if part.strip()]
        key = '_'.join(parts)
        key = userInput.lower().replace(' ', '_')
        if key not in existingList:
            return key

        counter = 1
        newKey = f'{key}_{counter}'
        while newKey in existingList:
            counter += 1
            newKey = f'{key}_{counter}'
        return newKey

    def onDataTypeChanged(self, index: int):
        dtype_text = self.typeCombo.itemText(index)
        dtype = dtype_text.split(' ')[0]
        if dtype == 'array':
            self.optionsEdit.setEnabled(True)
            self.optionsCsvDropArea.setEnabled(True)
            self.multiSelectChk.setEnabled(True)
        else:
            self.optionsEdit.setEnabled(False)
            self.optionsCsvDropArea.setEnabled(False)
            self.multiSelectChk.setEnabled(False)
            self.optionsEdit.clear()
            self.multiSelectChk.setChecked(False)

    def onOptionsCsvDropped(self, filePath: str):
        options = self._readOptionsFromCsv(filePath)
        if options is None:
            return

        # Keep existing save/validation logic by writing comma-separated values.
        self.optionsEdit.setText(', '.join(options))
        self.onOptionsChanged()

    def _readOptionsFromCsv(self, filePath: str) -> list[str] | None:
        # Expected format:
        # Options
        # Content Cell 01
        # Content Cell 02
        # ...
        try:
            with open(filePath, mode='r', newline='', encoding='utf-8-sig') as csvFile:
                rows = list(csv.reader(csvFile))
        except OSError as ex:
            QMessageBox.warning(self, 'CSV Import Error', f'Could not read CSV file.\n\n{ex}')
            return None

        nonEmptyRows = [row for row in rows if any(cell.strip() for cell in row)]
        if not nonEmptyRows:
            QMessageBox.warning(self, 'CSV Import Error', 'The CSV file is empty.')
            return None

        header = nonEmptyRows[0][0].strip().lower() if nonEmptyRows[0] else ''
        if header != 'options':
            QMessageBox.warning(
                self,
                'CSV Import Error',
                'Invalid CSV format. The first row must contain "Options".',
            )
            return None

        options = [
            row[0].strip()
            for row in nonEmptyRows[1:]
            if row and row[0].strip()
        ]

        if not options:
            QMessageBox.warning(
                self,
                'CSV Import Error',
                'No option values were found below the "Options" header.',
            )
            return None

        return options

    def onDisplayNameEdited(self, text: str):
        if self._column is None:
            key = self._generateUniqueKey(text, self._existingKeys)
            self.keyEdit.setText(key)

        if self._column is not None and (text == self._column.displayName() or text == ''):
            self.nameEdit.setStyleSheet('')
        else:
            self.nameEdit.setStyleSheet('QLineEdit {color: rgb(220, 150, 30);}')

    def onOptionsChanged(self):
        text = self.optionsEdit.text()
        options = [x.strip() for x in text.split(',') if x.strip()]
        if len(options) != len(set(options)):
            self.optionsEdit.setStyleSheet('color: red;')
            self.saveBtn.setEnabled(False)
        else:
            self.optionsEdit.setStyleSheet('')
            self.saveBtn.setEnabled(True)

    def onSystemToggled(self, checked: bool):
        if checked:
            self.globalChk.setChecked(True)
            self.globalChk.setEnabled(False)
            self.excludeEdit.setEnabled(False)
            self.excludeEdit.clear()
        else:
            self.globalChk.setEnabled(True)
            self.onGlobalToggled(self.globalChk.isChecked())

    def onGlobalToggled(self, checked: bool):
        if checked and not self.systemChk.isChecked():
            self.excludeEdit.setEnabled(True)
        else:
            self.excludeEdit.setEnabled(False)

    def onSave(self):
        name = self.nameEdit.text()
        key = self.keyEdit.text()
        dtypeText = self.typeCombo.currentText()
        dtype = dtypeText.split(' ')[0]
        role = self.roleCombo.currentData()
        if role is None:
            role = next(
                (
                    roleItem.keyName
                    for roleItem in Role
                    if roleItem.displayName == self.roleCombo.currentText()
                ),
                Role.Supervisor.keyName,
            )
        options = [x.strip() for x in self.optionsEdit.text().split(',') if x.strip()]
        multiSelect = self.multiSelectChk.isChecked() and self.multiSelectChk.isEnabled()
        visibled = self.visibleChk.isChecked()
        isSystem = self.systemChk.isChecked()
        isGlobal = self.globalChk.isChecked()
        exclude = [x.strip() for x in self.excludeEdit.text().split(',') if x.strip()]

        if name and key:
            try:
                if (
                    self._column is not None
                    and self._column.id() != ''
                    and key in self._existingKeys
                ):
                    self._api.updateColumn(
                        self._column.id(),
                        name,
                        dtype,
                        options,
                        multiSelect,
                        visibled,
                        isGlobal,
                        exclude,
                        isSystem,
                        role=role,
                    )
                else:
                    self._api.createColumn(
                        self._root,
                        name,
                        key,
                        dtype,
                        options,
                        multiSelect,
                        visibled,
                        isGlobal,
                        exclude,
                        isSystem,
                        role=role,
                    )
            except Exception as ex:
                QMessageBox.warning(
                    self,
                    'Save Column Failed',
                    f'Could not save column "{name}".\n\n{ex}',
                )
                return

            self._isChanged = True
            self._savedColumnKey = key
            self.accept()


class ColumnListDialog(QDialog):
    def __init__(
        self,
        api: ApiClient,
        project: str,
        studio: str,
        root: str,
        columns: list[Column],
        columnOrder: list[str],
        dataRepository: DataRepository,
        state: State,
        parent: QWidget | None = None,
    ):
        super().__init__(parent)
        self._api = api
        self._project = project
        self._studio = studio
        self._root = root
        self._columns = columns
        self._columnOrder = columnOrder
        self._dataRepo = dataRepository
        self._state = state

        self._user = self._state.userName()

        # Permission
        self._canEdit = self._state.hasPermission(Permission.CanEditColumns)
        self._canAdd = self._state.hasPermission(Permission.CanAddColumns)
        self._canRemove = self._state.hasPermission(Permission.CanRemoveColumns)
        self._canSaveProjectOrder = self._state.hasPermission(Permission.CanSaveProjectColumnOrder)

        self.setWindowTitle(f'[{self._root.title()}] Column Manager')
        self.resize(800, 500)
        layout = QVBoxLayout(self)

        columnBtnLayout = QHBoxLayout()
        hSpacer = QSpacerItem(40, 20, QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Minimum)
        saveColumnBtn = QPushButton('Save Column Order')
        saveColumnBtn.setMinimumWidth(120)
        saveColumnBtn.setVisible(self._canSaveProjectOrder)
        saveColumnBtn.clicked.connect(self.saveColumnOrder)
        columnBtnLayout.addItem(hSpacer)
        columnBtnLayout.addWidget(saveColumnBtn)
        if self._canSaveProjectOrder:
            layout.addLayout(columnBtnLayout)

        self.table = QTableWidget()
        self.table.setColumnCount(7)
        self.table.setHorizontalHeaderLabels(
            ['Name', 'Key', 'Type', 'Scope', 'Visible', 'System', 'Role']
        )
        self.table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        layout.addWidget(self.table)

        btnLayout = QHBoxLayout()
        addBtn = QPushButton('Add Column')
        addBtn.setEnabled(self._canAdd)
        editBtn = QPushButton('Edit Column')
        editBtn.setEnabled(self._canEdit)
        removeBtn = QPushButton('Remove Column')
        removeBtn.setEnabled(self._canRemove)
        btnLayout.addWidget(addBtn)
        btnLayout.addWidget(editBtn)
        btnLayout.addWidget(removeBtn)
        layout.addLayout(btnLayout)

        self.table.doubleClicked.connect(self.editColumn)
        addBtn.clicked.connect(self.addColumn)
        editBtn.clicked.connect(lambda: self.editColumn(self.table.currentIndex()))
        removeBtn.clicked.connect(self.removeColumn)

        self._isChanged = False

        self.refreshList(self._columns)
        if self.table.rowCount() > 0:
            self.table.selectRow(0)

    def _getColumnKeys(self) -> list[str]:
        return [column.key() for column in self._columns]

    def _rebuildColumns(self) -> None:
        allTemplates = list(self._dataRepo.loadTemplateColumns(self._project))
        tempColumns = [c for c in allTemplates if c.root() in ('common', self._root)]

        dbColumns = self._api.getColumns()
        tempExistKeys = {col.key() for col in tempColumns}

        for dbCol in dbColumns:
            if dbCol.get('root') not in ('common', self._root):
                continue

            column = Column.fromDict(dbCol)

            if column.key() not in tempExistKeys:
                tempColumns.append(column)
            else:
                for i, tempCol in enumerate(tempColumns):
                    if tempCol.key() == column.key():
                        tempColumns[i] = column
                        break

        self._columns = sorted(tempColumns, key=lambda c: c.createdAtUtc() or '0')

    def isChanged(self) -> bool:
        return self._isChanged

    def getColumns(self) -> list[Column]:
        return [col for col in self._columns]

    def refreshList(self, columns: list[Column] | None = None):
        cols = columns if columns is not None else self._columns
        _cols = {col.key(): col for col in cols}
        self.table.clearContents()
        self.table.setRowCount(len(_cols))

        rowIdx = 0
        for columnOrder in self._columnOrder:
            col = _cols.pop(columnOrder, None)

            if col is None:
                continue
            self.table.setItem(rowIdx, 0, QTableWidgetItem(col.displayName()))
            self.table.setItem(rowIdx, 1, QTableWidgetItem(col.key()))
            self.table.setItem(rowIdx, 2, QTableWidgetItem(col.dataType()))
            self.table.setItem(rowIdx, 3, QTableWidgetItem(col.scope()))
            self.table.setItem(rowIdx, 4, QTableWidgetItem(str(col.visibled())))
            self.table.setItem(rowIdx, 5, QTableWidgetItem(str(col.isSystem())))
            self.table.setItem(rowIdx, 6, QTableWidgetItem(col.roleDisplayName()))
            rowIdx += 1

        for col in _cols.values():
            self.table.setItem(rowIdx, 0, QTableWidgetItem(col.displayName()))
            self.table.setItem(rowIdx, 1, QTableWidgetItem(col.key()))
            self.table.setItem(rowIdx, 2, QTableWidgetItem(col.dataType()))
            self.table.setItem(rowIdx, 3, QTableWidgetItem(col.scope()))
            self.table.setItem(rowIdx, 4, QTableWidgetItem(str(col.visibled())))
            self.table.setItem(rowIdx, 5, QTableWidgetItem(str(col.isSystem())))
            self.table.setItem(rowIdx, 6, QTableWidgetItem(col.roleDisplayName()))
            rowIdx += 1

    def _selectRowByKey(self, key: str | None):
        if not key:
            return
        for row in range(self.table.rowCount()):
            item = self.table.item(row, 1)
            if item and item.text() == key:
                self.table.selectRow(row)
                self.table.scrollToItem(item)
                break

    def _getSelectedColumn(self, row: int) -> Column | None:
        keyItem = self.table.item(row, 1)
        if keyItem is None:
            return None
        key = keyItem.text()
        return next((col for col in self._columns if col.key() == key), None)

    def addColumn(self):
        keys = self._getColumnKeys()
        dlg = ColumnEditDialog(
            self._api,
            self._root,
            keys,
            self._dataRepo,
            self._state.roleManager(),
            parent=self,
        )
        if dlg.exec() == QDialog.DialogCode.Accepted:
            self._isChanged = True
            self._rebuildColumns()
            self.refreshList()
            self._selectRowByKey(dlg.savedColumnKey())

    def editColumn(self, index: QModelIndex):
        if not index.isValid():
            return
        row = index.row()
        colData = self._getSelectedColumn(row)
        if colData is None:
            return
        keys = self._getColumnKeys()
        dlg = ColumnEditDialog(
            self._api,
            self._root,
            keys,
            self._dataRepo,
            self._state.roleManager(),
            column=colData,
            parent=self,
        )
        if dlg.exec() == QDialog.DialogCode.Accepted:
            self._isChanged = True
            self._rebuildColumns()
            self.refreshList()
            self._selectRowByKey(dlg.savedColumnKey())

    def removeColumn(self):
        index = self.table.currentIndex()
        if not index.isValid():
            return
        row = index.row()
        colData = self._getSelectedColumn(row)
        if colData is None:
            return

        confirm = QMessageBox.question(
            self,
            'Confirm',
            f'Are you sure you want to remove column "{colData.displayName()}"?',
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if confirm == QMessageBox.StandardButton.Yes:
            self._api.deleteColumn(colData.id(), self._studio, self._user)
            self._isChanged = True
            self._rebuildColumns()
            self.refreshList()

    def saveColumnOrder(self):
        self._state.setColumnOrder(self._columnOrder, str(Sections.PROJECT), self._root)
