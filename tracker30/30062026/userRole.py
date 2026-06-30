from enum import Enum, IntEnum
from getpass import getuser
from collections import OrderedDict

from ppilib.desktop.setting import DesktopPipelineSetting


class Role(IntEnum):
    keyName: str
    displayName: str

    def __new__(cls, value: int, keyName: str, displayName: str):
        obj = int.__new__(cls, value)
        obj._value_ = value
        obj.keyName = keyName
        obj.displayName = displayName
        return obj

    Artist = (0, 'artist', 'Artist')
    Supervisor = (1, 'supervisor', 'Supervisor')
    Manager = (2, 'manager', 'Manager')
    Admin = (3, 'admin', 'Admin')

    @classmethod
    def fromKeyName(cls, keyName: str) -> 'Role':
        for role in cls:
            if role.keyName == keyName:
                return role
        return cls.Supervisor


class Permission(Enum):
    # Columns
    CanSeeColumns = 'can_see_columns'
    CanEditColumns = 'can_edit_columns'
    CanAddColumns = 'can_add_columns'
    CanRemoveColumns = 'can_remove_columns'
    CanSaveProjectColumnOrder = 'can_save_project_column_order'
    # Parameters
    CanSeeParameters = 'can_see_parameters'
    CanEditParameters = 'can_edit_parameters'
    # Roles
    CanEditRoles = 'can_edit_roles'


PERMISSION_RULE = {
    Permission.CanSeeColumns: Role.Artist,
    Permission.CanEditColumns: Role.Manager,
    Permission.CanAddColumns: Role.Manager,
    Permission.CanRemoveColumns: Role.Manager,
    Permission.CanSeeParameters: Role.Artist,
    Permission.CanEditParameters: Role.Supervisor,
    Permission.CanSaveProjectColumnOrder: Role.Manager,
    Permission.CanEditRoles: Role.Admin,
}


class RoleManager:
    def __init__(
        self,
        pipelineSetting: DesktopPipelineSetting,
        roleData: OrderedDict[Role, list[str]],
        role: Role = Role.Artist,
    ):
        self._pipelineSetting = pipelineSetting
        self._preference = self._pipelineSetting.preference()
        self._preferenceKey = '/ppiBreakdown/roles'
        self._currentRole = role
        self._name = getuser()
        self._roleData: OrderedDict[Role, list[str]] = roleData
        self.currentRole(self._name)

    def isAdmin(self):
        return self._currentRole.value >= Role.Admin.value

    def userRoles(self) -> OrderedDict[Role, list[str]]:
        return self._roleData

    def currentRole(self, name: str | None = None) -> Role:
        if name is None:
            name = self._name
        for role, users in self._roleData.items():
            if name in users:
                self._currentRole = role
                break
        return self._currentRole

    def hasPermission(self, permission: Permission) -> bool:
        requiredRole = PERMISSION_RULE.get(permission, Role.Admin)
        return self._currentRole.value >= requiredRole.value

    def userName(self) -> str:
        return self._name

    def currentRoleName(self) -> str:
        return self._currentRole.displayName
