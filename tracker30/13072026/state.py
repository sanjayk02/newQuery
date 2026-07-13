from collections import OrderedDict
from typing import cast

from ppilib.desktop.setting import DesktopPipelineSetting, DesktopSectionManager

from .appPrefs import AppPrefs
from .centralClient import CentralClient, Sections
from .userRole import Permission, Role, RoleManager


class State(object):
    PREFS_FILE_NAME = 'ppiBreakdown/appPrefs.ppijson'
    COLUMN_ORDER_KEY = '/ppiBreakdown/columnOrder'
    COLUMN_ROLE_KEY = '/ppiBreakdown/columnRoles'
    CENTRAL_API_URL = 'https://ppip30-api.polygonpictures.jp'
    CENTRAL_DEV_API_URL = 'https://ppip30dev-api.polygonpictures.jp'
    PPIBREAKDOWN_PREFERENCE_KEY = '/ppiBreakdown/roles'

    def __init__(self, sectionManager: DesktopSectionManager, isDev: bool):
        self._sectionManager = sectionManager
        self._pipelineSetting = cast(DesktopPipelineSetting, sectionManager.pipelineSetting())
        project = self._pipelineSetting.project()
        assert project is not None, 'No project selected in pipeline setting.'
        self._project = project
        studio = self._pipelineSetting.studio()
        assert studio is not None, 'No studio selected in pipeline setting.'
        self._studio = studio
        _bootstrapConf = self._sectionManager.bootstrapConf()
        self._prefsFilePath = _bootstrapConf.userPrefsDir() / self.PREFS_FILE_NAME
        self._appPrefs = AppPrefs.loadFromFile(self._prefsFilePath)
        self._centralClient = CentralClient(
            self.CENTRAL_DEV_API_URL if isDev else self.CENTRAL_API_URL
        )
        self._roleManager = RoleManager(self._pipelineSetting, self._emptyRoleData())

    def pipelineSetting(self) -> DesktopPipelineSetting:
        return self._pipelineSetting

    def projectName(self) -> str:
        return self._project.keyName()

    def studioName(self) -> str:
        return self._studio.keyName()

    def _getRolePreference(self) -> OrderedDict[Role, list[str]]:
        roleData: OrderedDict[Role, list[str]] = OrderedDict()
        for r in Role:
            users: list[str] = self._getPreference(r)
            roleData[r] = list(filter(str.strip, users))
        return roleData

    def _emptyRoleData(self) -> OrderedDict[Role, list[str]]:
        return OrderedDict((role, []) for role in Role)

    def loadRoleData(self) -> OrderedDict[Role, list[str]]:
        return self._getRolePreference()

    def applyRoleData(self, roleData: OrderedDict[Role, list[str]]) -> None:
        self._roleManager = RoleManager(
            self._pipelineSetting,
            roleData,
        )

    def _getPreference(self, role: Role) -> list[str]:
        key = f'{self.PPIBREAKDOWN_PREFERENCE_KEY}/{role.keyName}'
        resData = self.preference(Sections.PROJECT, self.projectName(), key)
        if not resData:
            resData = self.preference(Sections.STUDIO, self.studioName(), key)
        if not resData:
            return []

        firstItem = resData[0]
        if 'value' in firstItem and isinstance(firstItem['value'], str):
            return firstItem['value'].split(',')
        return []

    def resetRoleData(self):
        self.applyRoleData(self._getRolePreference())

    # App Prefs
    def appPrefs(self) -> AppPrefs:
        return self._appPrefs

    def savePrefsToFile(self):
        self._appPrefs.saveToFile(self._prefsFilePath)

    def columnOrder(self, root: str) -> list[str]:
        # user
        _columnOrder = self._appPrefs.columnOrder(self._project.keyName(), root)

        # project
        if not _columnOrder:
            pref = self.preference(
                Sections.PROJECT,
                self.projectName(),
                self.COLUMN_ORDER_KEY + '/' + root,
            )
            if (
                pref is None
                or len(pref) == 0
                or 'value' not in pref[0]
                or not isinstance(pref[0]['value'], str)
            ):
                return []
            _columnOrder = pref[0]['value'].split(',')
        return _columnOrder

    def setColumnOrder(self, columnKeys: list[str], section: str, root: str) -> None:
        if section == 'user':
            self._appPrefs.setColumnOrder(self._project.keyName(), root, columnKeys)
            self.savePrefsToFile()
            return
        self.upsertPreference(
            Sections.PROJECT,
            self.projectName(),
            self.COLUMN_ORDER_KEY + '/' + root,
            columnKeys,
        )

    def columnRoleOverrides(self, root: str) -> dict[str, str]:
        overrides: dict[str, str] = {}
        for role in Role:
            pref = self.preference(
                Sections.PROJECT,
                self.projectName(),
                f'{self.COLUMN_ROLE_KEY}/{root}/{role.keyName}',
            )
            if (
                pref is None
                or len(pref) == 0
                or 'value' not in pref[0]
                or not isinstance(pref[0]['value'], str)
            ):
                continue
            for columnKey in pref[0]['value'].split(','):
                columnKey = columnKey.strip()
                if columnKey:
                    overrides[columnKey] = role.keyName

        oldPref = self.preference(
            Sections.PROJECT,
            self.projectName(),
            self.COLUMN_ROLE_KEY + '/' + root,
        )
        if (
            oldPref is not None
            and len(oldPref) > 0
            and 'value' in oldPref[0]
            and isinstance(oldPref[0]['value'], str)
        ):
            for item in oldPref[0]['value'].split(','):
                if ':' not in item:
                    continue
                columnKey, roleKey = item.split(':', 1)
                if columnKey and roleKey and columnKey not in overrides:
                    overrides[columnKey] = Role.fromKeyName(roleKey).keyName
        return overrides

    def setColumnRole(self, root: str, columnKey: str, roleKey: str) -> None:
        overrides = self.columnRoleOverrides(root)
        overrides[columnKey] = Role.fromKeyName(roleKey).keyName
        for role in Role:
            columnKeys = sorted(
                key for key, savedRole in overrides.items()
                if savedRole == role.keyName
            )
            self.upsertPreference(
                Sections.PROJECT,
                self.projectName(),
                f'{self.COLUMN_ROLE_KEY}/{root}/{role.keyName}',
                columnKeys,
            )

    # Role Manager
    def roleManager(self) -> RoleManager:
        return self._roleManager

    def isAdmin(self) -> bool:
        return self._roleManager.isAdmin()

    def userRoles(self) -> OrderedDict[Role, list[str]]:
        return self._roleManager.userRoles()

    def currentRole(self, name: str | None = None) -> Role:
        return self._roleManager.currentRole(name)

    def hasPermission(self, permission: Permission) -> bool:
        return self._roleManager.hasPermission(permission)

    def userName(self) -> str:
        return self._roleManager.userName()

    def currentRoleName(self) -> str:
        return self._roleManager.currentRoleName()

    # Central Client
    def centralClient(self) -> CentralClient:
        return self._centralClient

    def preference(
        self,
        section: Sections,
        entry: str,
        key: str,
    ) -> list[dict[str, str | int | None]] | None:
        return self._centralClient.preference(section, entry, key)

    def upsertPreference(self, section: Sections, entry: str, key: str, value: list[str]):
        self._centralClient.upsertPreference(section, entry, key, value)
