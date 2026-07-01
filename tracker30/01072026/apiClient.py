from getpass import getuser
from typing import Any

import requests

from ppilib.core.centralclient.base import TokenProvider
from ppilib.desktop.setting import DesktopPipelineSetting

from .userRole import Role


class ApiClient(object):
    TIMEOUT = 60

    def __init__(self, pipelineSetting: DesktopPipelineSetting, isDev: bool = True) -> None:
        self._pipelineSetting = pipelineSetting
        _project = self._pipelineSetting.project()
        assert _project is not None, 'Project key name is not set in pipeline settings.'
        self._projectName = _project.keyName()
        _studio = self._pipelineSetting.studio()
        assert _studio is not None, 'Studio key name is not set in pipeline settings.'
        self._studioName = _studio.keyName()
        self._tokenProvider = TokenProvider(
            self._pipelineSetting.bootstrapConf(),
            studio=_studio,
        )
        self._baseUrl = self._pipelineSetting.bootstrapConf().centralUrl()
        _ppip30 = 'ppip30'
        if isDev:
            _ppip30 += 'dev'
        self._baseApiUrl = f'https://{_ppip30}-api.polygonpictures.jp'
        self._propertylistUrl = f'{self._baseApiUrl}/propertylist'

    def _getHeader(self) -> dict[str, str]:
        token = self._tokenProvider.accessToken()
        return {'Authorization': 'Bearer ' + token}

    def _raiseForColumnError(self, response: requests.Response, action: str) -> None:
        try:
            response.raise_for_status()
        except requests.HTTPError as ex:
            detail = response.text.strip()
            if detail:
                raise requests.HTTPError(
                    f'Failed to {action} column: {detail}',
                    response=response,
                ) from ex
            raise requests.HTTPError(
                f'Failed to {action} column: {response.status_code}',
                response=response,
            ) from ex

    # Columns
    def getColumns(self, root: str = '') -> list[Any]:
        try:
            url = f'{self._baseUrl}/api/projects/{self._projectName}/tracker/columns'
            if root:
                url += f'?root={root}'
            r = requests.get(
                url,
                headers=self._getHeader(),
                timeout=self.TIMEOUT,
            )
            r.raise_for_status()
            return r.json()
        except Exception as e:
            print(f'Error getting columns: {e}')
            return []

    def createColumn(
        self,
        root: str,
        displayName: str,
        key: str,
        dataType: str,
        options: list[Any] = [],
        isMultiSelect: bool = False,
        visibled: bool = True,
        isGlobal: bool = False,
        excludeProjects: list[str] = [],
        isSystem: bool = False,
        role: str = Role.Supervisor.keyName,
    ):
        payload: dict[str, Any] = {
            'role': Role.fromKeyName(role).keyName,
            'role_setting': Role.fromKeyName(role).keyName,
            'project': self._projectName,
            'root': root,
            'scope': 'global' if isGlobal else 'project',
            'exclude_projects': excludeProjects,
            'is_system': isSystem,
            'key': key,
            'display_name': displayName,
            'data_type': dataType,
            'config': {
                'options': options,
                'multi_select': isMultiSelect,
                'role': Role.fromKeyName(role).keyName,
                'role_setting': Role.fromKeyName(role).keyName,
            },
            'visibled': visibled,
            'user': getuser(),
        }
        response = requests.post(
            f'{self._baseUrl}/api/projects/{self._projectName}/tracker/columns',
            json=payload,
            headers=self._getHeader(),
            timeout=self.TIMEOUT,
        )
        self._raiseForColumnError(response, 'create')

    def updateColumn(
        self,
        columnID: str,
        displayName: str,
        dataType: str,
        options: list[Any] = [],
        isMultiSelect: bool = False,
        visibled: bool = True,
        isGlobal: bool = False,
        excludeProjects: list[str] = [],
        isSystem: bool = False,
        role: str = Role.Supervisor.keyName,
    ):
        payload: dict[str, Any] = {
            'role': Role.fromKeyName(role).keyName,
            'role_setting': Role.fromKeyName(role).keyName,
            'display_name': displayName,
            'data_type': dataType,
            'config': {
                'options': options,
                'multi_select': isMultiSelect,
                'role': Role.fromKeyName(role).keyName,
                'role_setting': Role.fromKeyName(role).keyName,
            },
            'visibled': visibled,
            'scope': 'global' if isGlobal else 'project',
            'exclude_projects': excludeProjects,
            'is_system': isSystem,
            'user': getuser(),
        }
        response = requests.put(
            f'{self._baseUrl}/api/projects/{self._projectName}/tracker/columns/{columnID}',
            json=payload,
            headers=self._getHeader(),
            timeout=self.TIMEOUT,
        )
        self._raiseForColumnError(response, 'update')

    def deleteColumn(self, columnID: str, studio: str, user: str):
        payload: dict[str, Any] = {
            'studio': studio,
            'user': user,
        }
        requests.delete(
            f'{self._baseUrl}/api/projects/{self._projectName}/tracker/columns/{columnID}',
            headers=self._getHeader(),
            json=payload,
            timeout=self.TIMEOUT,
        )

    # Entities
    def searchEntities(
        self,
        queryText: str = '',
        root: str = '',
        sortKey: str = 'group',
        sortDirection: int = -1,
    ) -> list[Any]:
        payload: dict[str, Any] = {
            'project': self._projectName,
            'filters': [],
            'sorts': [{'key': sortKey, 'direction': sortDirection}],
        }

        if queryText:
            payload['filters'].append(
                {
                    'key': 'group',
                    'operator': 'contains',
                    'value': queryText,
                }
            )

        if root:
            payload['filters'].append(
                {
                    'key': 'root',
                    'operator': 'eq',
                    'value': root,
                }
            )

        try:
            r = requests.post(
                f'{self._baseUrl}/api/projects/{self._projectName}/tracker/entities/search',
                json=payload,
                headers=self._getHeader(),
                timeout=self.TIMEOUT,
            )
            r.raise_for_status()
            return r.json()
        except Exception as e:
            print(f'Error searching: {e}')
            return []

    def createEntity(
        self,
        root: str,
        group: str,
        dataMap: dict[str, Any],
    ) -> None:
        payload: dict[str, Any] = {
            'project': self._projectName,
            'root': root,
            'group': group,
            'data': dataMap,
            'user': getuser(),
        }
        requests.post(
            f'{self._baseUrl}/api/tracker/entities',
            json=payload,
            headers=self._getHeader(),
            timeout=self.TIMEOUT,
        )

    def updateEntity(
        self,
        entityID: str,
        root: str,
        group: str,
        dataMap: dict[str, Any],
    ) -> None:
        payload: dict[str, Any] = {
            'root': root,
            'group': group,
            'data': dataMap,
            'user': getuser(),
            'studio': self._studioName,
        }
        requests.put(
            f'{self._baseUrl}/api/tracker/entities/{entityID}',
            json=payload,
            headers=self._getHeader(),
            timeout=self.TIMEOUT,
        )

    def getHistory(self, entityID: str) -> list[Any]:
        r = requests.get(
            f'{self._baseUrl}/api/tracker/entities/{entityID}/history',
            headers=self._getHeader(),
            timeout=self.TIMEOUT,
        )
        return r.json() if r.status_code == 200 else []

    def rollback(self, entityID: str, historyID: str) -> None:
        payload: dict[str, Any] = {
            'history_id': historyID,
            'user': getuser(),
            'studio': self._studioName,
        }
        requests.post(
            f'{self._baseUrl}/api/entities/{entityID}/rollback',
            json=payload,
            headers=self._getHeader(),
            timeout=self.TIMEOUT,
        )

    def deleteEntity(self, entityID: str) -> None:
        requests.delete(
            f'{self._baseUrl}/api/entities/{entityID}',
            headers=self._getHeader(),
            timeout=self.TIMEOUT,
        )

    # Pipeline Setting
    def getProperty(self, group: str, key: str, section: str = '') -> Any:
        keyType = group
        if section:
            keyType = section + keyType
        keyType += 'Key'
        res = requests.get(
            f'{self._propertylistUrl}/entries?key_type={keyType}&key={key}',
        )
        if not res.ok:
            res.raise_for_status()
        if 'propertylist_entries' not in res.json():
            raise ValueError('Invalid response: missing propertylist_entries')
        for record in res.json()['propertylist_entries']:
            if record['key'] != key:
                continue
            # TODO: ppilib30/scripts/settings.py を参考に実装
