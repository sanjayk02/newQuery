from collections import defaultdict
from logging import getLogger
from typing import TypeVar

from PySide6.QtWidgets import (
    QAbstractItemView,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from .centralClient import Sections
from .state import State
from .userRole import Role

K = TypeVar('K')
V = TypeVar('V')

_logger = getLogger(__name__)


def invertAndGroupDict(sourceDict: dict[K, V]) -> dict[V, list[K]]:
    inverted: defaultdict[V, list[K]] = defaultdict(list)
    for key, value in sourceDict.items():
        inverted[value].append(key)
    return dict(inverted)


class AddUserDialog(QDialog):
    def __init__(self, users: list[str], parent: QWidget | None = None):
        super().__init__(parent)
        self._users = users
        self._newUsers: dict[str, Role] = {}
        self.setWindowTitle('Add New Users')
        self.resize(500, 400)
        self.setupUi()

    def setupUi(self):
        layout = QVBoxLayout(self)
        layout.addWidget(QLabel('Enter the username and initial role.'))

        self.table = QTableWidget(1, 2)
        self.table.setHorizontalHeaderLabels(['Username', 'Initial Role'])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        layout.addWidget(self.table)
        self.addRowWidgets(0)

        btnLayout = QHBoxLayout()
        self.addRowBtn = QPushButton('+ Add Row')
        self.addRowBtn.clicked.connect(self.addEmptyRow)
        self.removeRowBtn = QPushButton('- Remove Selected Row')
        self.removeRowBtn.clicked.connect(self.removeSelectedRow)
        btnLayout.addWidget(self.addRowBtn)
        btnLayout.addWidget(self.removeRowBtn)
        btnLayout.addStretch()
        layout.addLayout(btnLayout)

        self.buttonBox = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        self.buttonBox.accepted.connect(self.validateAndAccept)
        self.buttonBox.rejected.connect(self.reject)
        layout.addWidget(self.buttonBox)

    def addRowWidgets(self, row: int):
        edit = QLineEdit()
        edit.setPlaceholderText('Enter Username...')
        self.table.setCellWidget(row, 0, edit)

        combo = QComboBox()
        for r in Role:
            combo.addItem(r.displayName, r)
        combo.setCurrentIndex(1)
        self.table.setCellWidget(row, 1, combo)
        edit.setFocus()

    def addEmptyRow(self):
        rowCount = self.table.rowCount()
        self.table.insertRow(rowCount)
        self.addRowWidgets(rowCount)

    def removeSelectedRow(self):
        if self.table.rowCount() > 1:
            self.table.removeRow(self.table.currentRow())

    def validateAndAccept(self):
        self._newUsers = {}
        for row in range(self.table.rowCount()):
            username = self.table.cellWidget(row, 0).text().strip()
            role = self.table.cellWidget(row, 1).currentData()

            if username:
                if username in self._users:
                    res = QMessageBox.question(
                        self,
                        'Username already exists.',
                        f'"{username}" already exists. Do you want to overwrite it?',
                    )
                    if res == QMessageBox.StandardButton.No:
                        continue
                self._newUsers[username] = role

        if not self._newUsers:
            QMessageBox.warning(self, 'Error', 'No valid usernames were entered.')
            return
        self.accept()

    def newUsers(self):
        return self._newUsers


class RoleManagerDialog(QDialog):
    def __init__(self, state: State, parent: QWidget | None = None):
        super().__init__(parent)
        self._state = state
        self._userRoles = self._state.userRoles()
        self.setWindowTitle('Role Manager')
        self.resize(700, 500)
        self.setupUi()
        self.refreshData()

    def setupUi(self):
        layout = QVBoxLayout(self)

        # Header, Status, Add User Button
        headerLayout = QHBoxLayout()
        self.statusLabel = QLabel()
        headerLayout.addWidget(self.statusLabel)
        headerLayout.addStretch()

        self.addUserBtn = QPushButton('+ Add User')
        self.addUserBtn.setFixedWidth(120)
        self.addUserBtn.clicked.connect(self._showAddUserDialog)
        headerLayout.addWidget(self.addUserBtn)

        layout.addLayout(headerLayout)

        # Batch Conversion Area
        batchLayout = QHBoxLayout()
        batchLayout.addWidget(QLabel('Batch Conversion:'))
        self.batchCombo = QComboBox()
        for r in Role:
            self.batchCombo.addItem(r.displayName, r)
        self.batchBtn = QPushButton('Apply to Selected Rows')
        self.batchBtn.clicked.connect(self.applyBatchRole)
        batchLayout.addWidget(self.batchCombo)
        batchLayout.addWidget(self.batchBtn)

        # Add button for checking users by role
        batchLayout.addStretch()
        self.summaryBtn = QPushButton('Check Users by Role')
        self.summaryBtn.clicked.connect(self.showRoleSummary)
        self.summaryBtn.setVisible(False)
        batchLayout.addWidget(self.summaryBtn)

        layout.addLayout(batchLayout)

        # table
        self.table = QTableWidget(0, 2)
        self.table.setHorizontalHeaderLabels(['Username', 'Role'])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        layout.addWidget(self.table)

        # Bottom Button Group
        btnBoxLayout = QHBoxLayout()

        self.applyBtn = QPushButton('Save Changes and Apply')
        self.applyBtn.setFixedHeight(40)
        self.applyBtn.clicked.connect(self.saveChanges)

        self.closeBtn = QPushButton('Close')
        self.closeBtn.setFixedHeight(40)
        self.closeBtn.clicked.connect(self.reject)

        btnBoxLayout.addWidget(self.applyBtn)
        btnBoxLayout.addWidget(self.closeBtn)
        layout.addLayout(btnBoxLayout)

    def refreshData(self):
        currentUser = self._state.userName()
        self.statusLabel.setText(f'Login: {currentUser}')

        self.table.setRowCount(0)
        for role, users in self._userRoles.items():
            for username in sorted(users):
                currentRow = self.table.rowCount()
                self.table.insertRow(currentRow)

                self.table.setItem(currentRow, 0, QTableWidgetItem(username))

                combo = QComboBox()
                for r in Role:
                    combo.addItem(r.displayName, userData=r)

                combo.setCurrentIndex(combo.findData(role))
                self.table.setCellWidget(currentRow, 1, combo)

    def getUsersByRole(self):
        usersByRole: dict[Role, list[str]] = {r: [] for r in Role}
        for row in range(self.table.rowCount()):
            username = self.table.item(row, 0).text()
            combo = self.table.cellWidget(row, 1)
            if combo:
                role = combo.currentData()
                usersByRole[role].append(username)
        return usersByRole

    def showRoleSummary(self):
        summaryData: dict[Role, list[str]] = self.getUsersByRole()
        textLines = []
        for role, users in summaryData.items():
            userCount = len(users)
            userListStr = ', '.join(users) if users else 'なし'
            textLines.append(f'■ {role.displayName} ({userCount}名)\n  {userListStr}')
        QMessageBox.information(self, 'ロール別ユーザー確認', '\n\n'.join(textLines))

    def _updateUserRoles(self, newUserRoles: dict[str, Role]):
        for newUser, role in newUserRoles.items():

            # Check all existing lists and delete any outdated data
            for roleKey, users in self._userRoles.items():
                if newUser in users:
                    if roleKey != role:
                        users.remove(newUser)
                    break

            # Add to the list of new objects
            targetList = self._userRoles.setdefault(role, [])

            # Add only if the object does not already exist in the list (to prevent duplicate entries for the same object)  # noqa: E501
            if newUser not in targetList:
                targetList.append(newUser)

    def _showAddUserDialog(self):
        users = [
            username
            for roleUsers in self._userRoles.values()
            for username in roleUsers
        ]
        dialog = AddUserDialog(users, self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            newUsers = dialog.newUsers()
            self._updateUserRoles(newUsers)
            self.refreshData()

    def applyBatchRole(self):
        selectedRows = set(item.row() for item in self.table.selectedItems())
        targetRole = self.batchCombo.currentData()
        for row in selectedRows:
            combo = self.table.cellWidget(row, 1)
            if combo and combo.isEnabled():
                combo.setCurrentIndex(combo.findData(targetRole))

    def _upsertUserRoles(self, role: Role, users: list[str]):
        key = f'/ppiBreakdown/roles/{role.keyName}'
        _logger.debug(f'Upserting user roles for key: {key} with users: {users}')
        self._state.upsertPreference(
            section=Sections.PROJECT,
            entry=self._state.projectName(),
            key=key,
            value=users,
        )

    def saveChanges(self):
        for role, users in self.getUsersByRole().items():
            if not users:
                continue
            _users = users.copy()
            if role is Role.Admin and self._state.userName() not in _users:
                _users.append(self._state.userName())
            self._upsertUserRoles(role, _users)

        self._state.resetRoleData()
        QMessageBox.information(self, 'Done', 'Settings saved.')
        self.accept()
