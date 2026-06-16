from typing import Any

from ppui.PySide.QtCore import Qt, QEvent, QObject, QTimer, QPoint
from ppui.PySide.QtGui import (
    QColor,
    QMouseEvent,
    QPainter,
    QPaintEvent,
    QPen,
    QStandardItem,
    QStandardItemModel,
)
from ppui.PySide.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDialog,
    QDoubleSpinBox,
    QFormLayout,
    QListView,
    QMessageBox,
    QPushButton,
    QScrollArea,
    QSpinBox,
    QWidget,
    QVBoxLayout,
    QTextEdit,
    QSizePolicy,
)

from .apiClient import ApiClient
from .tableData import Column


MIXED_TEXT = 'MULTI'
MIXED_DATA = '__ppi_tracker_mixed__'


class ResizableTextEdit(QTextEdit):
    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.setMinimumHeight(60)
        self.setMaximumHeight(300)
        self._resizing = False
        self._dragStartPos = QPoint()
        self._startHeight = 0
        self._isMixed = False
        self.setMouseTracking(True)
        self.textChanged.connect(self._clearMixed)

    def setMixed(self):
        self._isMixed = True
        self.setPlaceholderText(MIXED_TEXT)

    def isMixed(self) -> bool:
        return self._isMixed

    def _clearMixed(self):
        self._isMixed = False

    def mousePressEvent(self, event: QMouseEvent):
        if event.button() == Qt.MouseButton.LeftButton:
            vpGeo = self.viewport().geometry()
            bottomRight = vpGeo.bottomRight()
            pos = event.position()
            isXBottomRight = pos.x() <= bottomRight.x()
            isYBottomRight = pos.y() <= bottomRight.y()

            isWidthArea = bottomRight.x() - pos.x() < 15
            isHeightArea = bottomRight.y() - pos.y() < 15
            if isWidthArea and isHeightArea and isXBottomRight and isYBottomRight:
                self._resizing = True
                self._dragStartPos = event.globalPosition().toPoint()
                self._startHeight = self.height()
                return
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event: QMouseEvent):
        if self._resizing:
            delta = event.globalPosition().toPoint().y() - self._dragStartPos.y()
            newHeight = max(60, min(300, self._startHeight + delta))
            self.setFixedHeight(newHeight)
            return

        super().mouseMoveEvent(event)

        vpGeo = self.viewport().geometry()
        bottomRight = vpGeo.bottomRight()
        pos = event.position()
        isXBottomRight = pos.x() <= bottomRight.x()
        isYBottomRight = pos.y() <= bottomRight.y()
        isWidthArea = bottomRight.x() - pos.x() < 15
        isHeightArea = bottomRight.y() - pos.y() < 15
        if isWidthArea and isHeightArea and isXBottomRight and isYBottomRight:
            self.viewport().setCursor(Qt.CursorShape.SizeVerCursor)
        else:
            self.viewport().setCursor(Qt.CursorShape.IBeamCursor)

        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event: QMouseEvent):
        if self._resizing:
            self._resizing = False
            return
        super().mouseReleaseEvent(event)

    def paintEvent(self, event: QPaintEvent):
        super().paintEvent(event)
        # Draw resize grip indicator (three lines)
        painter = QPainter(self.viewport())
        painter.setPen(QPen(QColor(150, 150, 150), 1))
        w = self.viewport().width()
        h = self.viewport().height()

        for i in range(1, 4):
            offset = i * 4
            painter.drawLine(w - offset, h, w, h - offset)


class EntityEditorDialog(QDialog):
    @staticmethod
    def _getColumnValueState(
        entityData: list[dict[str, Any]],
        columnKey: str,
    ) -> tuple[Any, bool]:
        values = [
            '' if data.get(columnKey) is None else data.get(columnKey)
            for data in entityData
        ]
        commonValue = values[0] if values else None
        hasMixedValues = any(value != commonValue for value in values[1:])
        return commonValue, hasMixedValues

    def __init__(
        self,
        api: ApiClient,
        root: str,
        groups: list[str],
        columns: list[Column],
        entities: list[dict[str, Any] | None],
        parent: QWidget | None = None
    ) -> None:
        super().__init__(parent)
        self._api = api
        self._root = root
        self._groups = groups
        self._columns = columns
        self._entities = entities
        self._isMultiEdit = len(groups) > 1
        if self._isMultiEdit:
            self.setWindowTitle(f'[{root.title()}] Edit {len(groups)} Entities')
        else:
            self.setWindowTitle(f'[{root.title()}:{groups[0]}] Edit Entity')
        self.resize(500, 600)

        self._mainLayout = QVBoxLayout(self)
        self._scrollArea = QScrollArea()
        self._scrollArea.setWidgetResizable(True)
        self._contentWidget = QWidget()

        self._layout = QFormLayout(self._contentWidget)
        self._widgets: dict[str, tuple[QWidget, str]] = {}
        self._columnDisplayNames: dict[str, str] = {}
        self._initialData: dict[str, Any] = {}
        self._mixedKeys: set[str] = set()
        entityData = [entity.get('data', {}) if entity else {} for entity in self._entities]

        self._savedRoot = root
        self._savedGroups = list(groups)
        self._savedData: dict[str, Any] = {}

        for col in self._columns:
            if not col.visibled():
                continue

            key = col.key()
            dtype = col.dataType()
            display = col.displayName()
            isSys = col.isSystem()
            scope = 'project' if not col.scope() else col.scope()

            # Show scope in label
            labelText = f'{display}'
            if isSys:
                labelText += ' [System]'
            labelText += ' (Global)' if scope == 'global' else ' (Project)'

            currentVal, isMixed = self._getColumnValueState(entityData, key)
            if isMixed:
                self._mixedKeys.add(key)
            else:
                self._initialData[key] = currentVal

            widget = None
            if dtype == 'array':
                isMulti = col.config().get('multi_select', False)
                if isMulti:
                    widget = CheckableComboBox()
                else:
                    widget = QComboBox()
                    widget.addItem('')

                opts = col.config().get('options', [])
                widget.addItems(opts)

                if isMixed:
                    if isinstance(widget, CheckableComboBox):
                        widget.setMixed()
                    else:
                        widget.insertItem(0, MIXED_TEXT, MIXED_DATA)
                        widget.setCurrentIndex(0)
                elif currentVal is not None:
                    if isMulti:
                        vals = [val.strip() for val in str(currentVal).split(',')]
                        for v in vals:
                            index = widget.findText(v)
                            if index != -1:
                                widget.model().item(index).setCheckState(Qt.CheckState.Checked)
                    else:
                        widget.setCurrentText(str(currentVal))
            elif dtype == 'int':
                widget = QSpinBox()
                if isMixed:
                    widget.setRange(-1000000, 999999)
                    widget.setSpecialValueText(MIXED_TEXT)
                    widget.setValue(widget.minimum())
                else:
                    widget.setRange(-999999, 999999)
                if currentVal is not None and not isMixed:
                    try:
                        widget.setValue(int(currentVal))
                    except (ValueError, TypeError):
                        self._initialData[key] = widget.value()
            elif dtype == 'float':
                widget = QDoubleSpinBox()
                widget.setDecimals(2)
                if isMixed:
                    widget.setRange(-1000000.99, 999999.99)
                    widget.setSpecialValueText(MIXED_TEXT)
                    widget.setValue(widget.minimum())
                else:
                    widget.setRange(-999999.99, 999999.99)
                if currentVal is not None and not isMixed:
                    try:
                        widget.setValue(float(currentVal))
                    except (ValueError, TypeError):
                        self._initialData[key] = widget.value()
            elif dtype == 'bool':
                widget = QCheckBox()
                if isMixed:
                    widget.setTristate(True)
                    widget.setCheckState(Qt.CheckState.PartiallyChecked)
                else:
                    widget.setChecked(bool(currentVal))
            elif dtype == 'string':
                widget = ResizableTextEdit()
                if isMixed:
                    widget.setMixed()
                elif currentVal:
                    widget.setText(str(currentVal))

            if widget is None:
                continue
            self._columnDisplayNames[key] = display
            if not isMixed:
                if dtype == 'array':
                    if isinstance(widget, CheckableComboBox):
                        self._initialData[key] = ', '.join(widget.getCheckedItems())
                    else:
                        self._initialData[key] = widget.currentText()
                elif dtype in ('int', 'float'):
                    self._initialData[key] = widget.value()
                elif dtype == 'bool':
                    self._initialData[key] = widget.isChecked()
                elif dtype == 'string':
                    self._initialData[key] = widget.toPlainText()
            self._layout.addRow(f'{labelText}:', widget)
            self._widgets[key] = (widget, dtype)

        self._scrollArea.setWidget(self._contentWidget)
        self._mainLayout.addWidget(self._scrollArea)

        btnSave = QPushButton('Save')
        btnSave.clicked.connect(self.save)
        self._mainLayout.addWidget(btnSave)

    def _collectChanges(self) -> dict[str, Any]:
        data: dict[str, Any] = {}
        for key, (widget, dtype) in self._widgets.items():
            isMixed = key in self._mixedKeys
            if dtype == 'array':
                if isinstance(widget, CheckableComboBox):
                    if isMixed and widget.isMixed():
                        continue
                    data[key] = ', '.join(widget.getCheckedItems())
                else:
                    if isMixed and widget.currentData() == MIXED_DATA:
                        continue
                    data[key] = widget.currentText()
            elif dtype == 'int':
                if isMixed and widget.value() == widget.minimum():
                    continue
                data[key] = widget.value()
            elif dtype == 'float':
                if isMixed and widget.value() == widget.minimum():
                    continue
                data[key] = widget.value()
            elif dtype == 'bool':
                if isMixed and widget.checkState() == Qt.CheckState.PartiallyChecked:
                    continue
                data[key] = widget.isChecked()
            elif dtype == 'string':
                if isMixed and widget.isMixed():
                    continue
                data[key] = widget.toPlainText()

        sendData: dict[str, Any] = {}
        for key, value in data.items():
            if key in self._mixedKeys or value != self._initialData.get(key):
                sendData[key] = value
        return sendData

    def _confirmMixedOverwrite(self, sendData: dict[str, Any]) -> bool:
        mixedChangedKeys = [key for key in sendData if key in self._mixedKeys]
        if not mixedChangedKeys:
            return True

        columnNames = [
            self._columnDisplayNames.get(key, key)
            for key in mixedChangedKeys
        ]
        if len(columnNames) == 1:
            message = (
                f'"{columnNames[0]}" has different values in the selected rows.\n\n'
                'Click Ok to replace the old values with the new value, '
                'or Cancel to keep the old values.'
            )
        else:
            message = (
                'These columns have different values in the selected rows:\n'
                f'{", ".join(columnNames)}\n\n'
                'Click Ok to replace the old values with the new values, '
                'or Cancel to keep the old values.'
            )

        confirm = QMessageBox.question(
            self,
            'Confirm Replace Values',
            message,
            QMessageBox.StandardButton.Ok | QMessageBox.StandardButton.Cancel,
            QMessageBox.StandardButton.Cancel,
        )
        return confirm == QMessageBox.StandardButton.Ok

    def save(self):
        sendData = self._collectChanges()
        if not sendData:
            self.reject()
            return

        if not self._confirmMixedOverwrite(sendData):
            return

        for group, entity in zip(self._groups, self._entities):
            if entity:
                self._api.updateEntity(entity['id'], self._root, group, sendData)
            else:
                self._api.createEntity(self._root, group, sendData)

        self._savedRoot = self._root
        self._savedGroups = list(self._groups)
        self._savedData = sendData
        self.accept()

    def getSavedInfo(self) -> tuple[str, list[str], dict[str, Any]]:
        return self._savedRoot, self._savedGroups, self._savedData


class CheckableComboBox(QComboBox):
    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self.setEditable(True)
        self.lineEdit().setReadOnly(True)
        self._model = QStandardItemModel(self)
        self._isMixed = False
        self.setModel(self._model)
        self.setView(QListView())
        self._model.itemChanged.connect(self.updateDisplayText)
        self.currentIndexChanged.connect(self.updateDisplayText)
        self.view().viewport().installEventFilter(self)

    def model(self) -> QStandardItemModel:
        return self._model

    def addItem(self, text: str, userData: Any = None):
        item = QStandardItem(text)
        item.setData(userData)
        item.setFlags(Qt.ItemFlag.ItemIsUserCheckable | Qt.ItemFlag.ItemIsEnabled)
        item.setCheckState(Qt.CheckState.Unchecked)
        self._model.appendRow(item)

    def addItems(self, texts: list[str], userData: list[Any] | None = None):
        if userData is None:
            userData = [None] * len(texts)
        for text, userData in zip(texts, userData):
            self.addItem(text, userData)

    def setMixed(self):
        self._isMixed = True
        self.lineEdit().setText(MIXED_TEXT)

    def isMixed(self) -> bool:
        return self._isMixed

    def updateDisplayText(self, _: QStandardItem | None = None):
        def _update():
            if self._isMixed:
                self.lineEdit().setText(MIXED_TEXT)
                return
            checkedItems: list[str] = []
            for index in range(self._model.rowCount()):
                _item = self._model.item(index)
                if _item.checkState() == Qt.CheckState.Checked:
                    checkedItems.append(_item.text())
            text = ', '.join(checkedItems) if checkedItems else ''
            self.lineEdit().setText(text)
        QTimer.singleShot(0, _update)

    def getCheckedItems(self) -> list[str]:
        checkedData: list[str] = []
        for index in range(self._model.rowCount()):
            item = self._model.item(index)
            if item.checkState() == Qt.CheckState.Checked:
                checkedData.append(item.text())
        return checkedData

    def eventFilter(self, watched: QObject, event: QEvent) -> bool:
        if watched == self.view().viewport():
            if event.type() == QEvent.Type.MouseButtonRelease:
                index = self.view().indexAt(event.position().toPoint())
                item = self._model.itemFromIndex(index)
                if item is None:
                    return False
                self._isMixed = False
                if item.checkState() == Qt.CheckState.Checked:
                    item.setCheckState(Qt.CheckState.Unchecked)
                else:
                    item.setCheckState(Qt.CheckState.Checked)
                return True
        return False
