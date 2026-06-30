import os
from typing import Any, Iterator

from ppilib.utils.serialize import readJson

from .userRole import Role


class Column(object):
    __slots__ = (
        '_id',
        '_project',
        '_root',
        '_scope',
        '_excludeProjects',
        '_isSystem',
        '_key',
        '_displayName',
        '_dataType',
        '_role',
        '_config',
        '_visibled',
        '_deleted',
        '_createdAtUtc',
        '_modifiedAtUtc',
        '_createdBy',
        '_modifiedBy',
    )

    @classmethod
    def fromDict(cls, data: dict[str, Any]) -> 'Column':
        id: str = data.get('id', '')
        project: str = data.get('project', 'potoodev')
        root: str = data.get('root', '')
        scope: str = data.get('scope', '')
        excludeProjects: list[str] = data.get('exclude_projects', [])
        isSystem: bool = data.get('is_system', False)
        key: str = data.get('key', '')
        displayName: str = data.get('display_name', '')
        dataType: str = data.get('data_type', '')
        role: str = data.get('role', Role.Supervisor.keyName)
        config: dict[str, Any] = data.get('config', {})
        visibled: bool = data.get('visibled', False)
        deleted: str = data.get('deleted', '0')
        createdAtUtc: str = data.get('created_at_utc', '')
        modifiedAtUtc: str = data.get('modified_at_utc', '')
        createdBy: str = data.get('created_by', '')
        modifiedBy: str = data.get('modified_by', '')
        return cls(
            id,
            project,
            root,
            scope,
            excludeProjects,
            isSystem,
            key,
            displayName,
            dataType,
            role,
            config,
            visibled,
            deleted,
            createdAtUtc,
            modifiedAtUtc,
            createdBy,
            modifiedBy,
        )

    def __init__(
        self,
        id: str,
        project: str,
        root: str,
        scope: str,
        excludeProjects: list[str],
        isSystem: bool,
        key: str,
        displayName: str,
        dataType: str,
        role: str,
        config: dict[str, Any],
        visibled: bool,
        deleted: str,
        createdAtUtc: str,
        modifiedAtUtc: str,
        createdBy: str,
        modifiedBy: str,
    ) -> None:
        self._id = id
        self._project = project
        self._root = root
        self._scope = scope
        self._excludeProjects = excludeProjects
        self._isSystem = isSystem
        self._key = key
        self._displayName = displayName
        self._dataType = dataType
        self._role = Role.fromKeyName(role).keyName
        self._config = config
        self._visibled = visibled
        self._deleted = deleted
        self._createdAtUtc = createdAtUtc
        self._modifiedAtUtc = modifiedAtUtc
        self._createdBy = createdBy
        self._modifiedBy = modifiedBy

    def id(self) -> str:
        return self._id

    def project(self) -> str:
        return self._project

    def root(self) -> str:
        return self._root

    def scope(self) -> str:
        return self._scope

    def excludeProjects(self) -> list[str]:
        return self._excludeProjects

    def isSystem(self) -> bool:
        return self._isSystem

    def key(self) -> str:
        return self._key

    def displayName(self) -> str:
        return self._displayName

    def dataType(self) -> str:
        return self._dataType

    def role(self) -> Role:
        return Role.fromKeyName(self._role)

    def roleKey(self) -> str:
        return self._role

    def roleDisplayName(self) -> str:
        return self.role().displayName

    def config(self) -> dict[str, Any]:
        return self._config

    def visibled(self) -> bool:
        return self._visibled

    def deleted(self) -> str:
        return self._deleted

    def createdAtUtc(self) -> str:
        return self._createdAtUtc

    def modifiedAtUtc(self) -> str:
        return self._modifiedAtUtc

    def createdBy(self) -> str:
        return self._createdBy

    def modifiedBy(self) -> str:
        return self._modifiedBy

    def asDict(self) -> dict[str, Any]:
        return {
            'id': self._id,
            'project': self._project,
            'root': self._root,
            'scope': self._scope,
            'exclude_projects': self._excludeProjects,
            'is_system': self._isSystem,
            'key': self._key,
            'display_name': self._displayName,
            'data_type': self._dataType,
            'role': self._role,
            'config': self._config,
            'visibled': self._visibled,
            'deleted': self._deleted,
            'created_at_utc': self._createdAtUtc,
            'modified_at_utc': self._modifiedAtUtc,
            'created_by': self._createdBy,
            'modified_by': self._modifiedBy,
        }


class Entity(object):
    __slots__ = (
        '_id',
        '_project',
        '_root',
        '_group',
        '_data',
        '_createdAtUtc',
        '_modifiedAtUtc',
        '_createdBy',
        '_modifiedBy',
        '_deleted',
    )

    @classmethod
    def fromDict(cls, data: dict[str, Any]) -> 'Entity':
        id: str = data.get('id', '')
        project: str = data.get('project', 'potoodev')
        root: str = data.get('root', '')
        group: str = data.get('group', '')
        _data: dict[str, Any] = data.get('data', {})
        createdAtUtc: str = data.get('created_at_utc', '')
        modifiedAtUtc: str = data.get('modified_at_utc', '')
        createdBy: str = data.get('created_by', '')
        modifiedBy: str = data.get('modified_by', '')
        deleted: str = data.get('deleted', '0')
        return cls(
            id,
            project,
            root,
            group,
            _data,
            createdAtUtc,
            modifiedAtUtc,
            createdBy,
            modifiedBy,
            deleted,
        )

    def __init__(
        self,
        id: str,
        project: str,
        root: str,
        group: str,
        data: dict[str, Any],
        createdAtUtc: str,
        modifiedAtUtc: str,
        createdBy: str,
        modifiedBy: str,
        deleted: str,
    ) -> None:
        self._id = id
        self._project = project
        self._root = root
        self._group = group
        self._data = data
        self._createdAtUtc = createdAtUtc
        self._modifiedAtUtc = modifiedAtUtc
        self._createdBy = createdBy
        self._modifiedBy = modifiedBy
        self._deleted = deleted

    def id(self) -> str:
        return self._id

    def project(self) -> str:
        return self._project

    def root(self) -> str:
        return self._root

    def group(self) -> str:
        return self._group

    def data(self) -> dict[str, Any]:
        return self._data

    def createdAtUtc(self) -> str:
        return self._createdAtUtc

    def modifiedAtUtc(self) -> str:
        return self._modifiedAtUtc

    def createdBy(self) -> str:
        return self._createdBy

    def modifiedBy(self) -> str:
        return self._modifiedBy

    def deleted(self) -> str:
        return self._deleted

    def asDict(self) -> dict[str, Any]:
        return {
            'id': self._id,
            'project': self._project,
            'root': self._root,
            'group': self._group,
            'data': self._data,
            'created_at_utc': self._createdAtUtc,
            'modified_at_utc': self._modifiedAtUtc,
            'created_by': self._createdBy,
            'modified_by': self._modifiedBy,
            'deleted': self._deleted,
        }


class DataRepository(object):
    def __init__(self, isDev: bool):
        self._isDev = isDev

    def loadTemplateColumns(self, project: str) -> Iterator[Column]:
        confFileName = 'dev.ppijson' if self._isDev else 'pro.ppijson'
        confFilePath = os.path.join(os.path.dirname(__file__), 'config', confFileName)
        confData: dict[str, Any] = readJson(confFilePath)
        columnsData = confData.get('columns', {})

        # Common
        columnCommonData = columnsData.get('common', {})
        defaultCommonColumnData: list[dict[str, Any]] = columnCommonData.get('default', [])
        projectCommonColumnData: list[dict[str, Any]] = columnCommonData.get(project, [])

        # Assets
        columnAssetsData = columnsData.get('assets', {})
        defaultAssetsColumnData: list[dict[str, Any]] = columnAssetsData.get('default', [])
        projectAssetsColumnData: list[dict[str, Any]] = columnAssetsData.get(project, [])

        # Shots
        columnShotsData = columnsData.get('shots', {})
        defaultShotsColumnData: list[dict[str, Any]] = columnShotsData.get('default', [])
        projectShotsColumnData: list[dict[str, Any]] = columnShotsData.get(project, [])

        for data in (defaultCommonColumnData + projectCommonColumnData):
            data['root'] = 'common'
            yield Column.fromDict(data)
        for data in (defaultAssetsColumnData + projectAssetsColumnData):
            data['root'] = 'assets'
            yield Column.fromDict(data)
        for data in (defaultShotsColumnData + projectShotsColumnData):
            data['root'] = 'shots'
            yield Column.fromDict(data)
