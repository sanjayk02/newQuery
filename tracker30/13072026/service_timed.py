from typing import Iterator, Optional, Protocol, TypedDict

from PySide6.QtCore import QObject, QRect, QRunnable, QThreadPool, Signal
from PySide6.QtGui import QColor, QImage

from ppilib.core.centralclient.pipelineParameter import SQLiteRepository
from ppilib.core.entity.pipelineParameter import Value
from ppilib.core.phase.structure2 import Group, PhaseStructure
from ppilib.core.setting import AbstractProjectSetting
from ppilib.desktop.setting import DesktopPipelineSetting
from ppilib.utils.compat.pathlib import Path


class Task(Protocol):
    def run(self) -> None: ...


class Runnable(QRunnable):
    def __init__(self, task: Task) -> None:
        super().__init__()
        self._task = task

    def run(self) -> None:
        self._task.run()


class ThreadPool:
    def __init__(self) -> None:
        self._threadPool = QThreadPool()

    def start(self, task: Task) -> None:
        self._threadPool.start(Runnable(task))

    def activeThreadCount(self) -> int:
        return self._threadPool.activeThreadCount()

    def maxThreadCount(self) -> int:
        return self._threadPool.maxThreadCount()


class ThumbnailPaths(TypedDict, total=False):
    small: Path
    medium: Path
    large: Path
    animated: Path


class Service(object):
    def __init__(self, pipelineSetting: DesktopPipelineSetting) -> None:
        import time
        _t0 = time.perf_counter()

        def _mark(label: str) -> None:
            print(f'[TIMING][Service] {label}: {time.perf_counter() - _t0:.3f}s elapsed')

        self._pipelineSetting = pipelineSetting
        project = pipelineSetting.project()
        assert project is not None
        self._project = project
        _mark('project resolved')
        self._phaseStructure = PhaseStructure(self._pipelineSetting)
        _mark('PhaseStructure() constructed')
        self._sqLiteRepo = SQLiteRepository(pipelineSetting)
        _mark('SQLiteRepository() constructed')
        self._defaultThumbnail = self._createDefaultThumbnail()
        _mark('_createDefaultThumbnail() done')
        self._threadPool = ThreadPool()
        _mark('ThreadPool() constructed')

    def project(self) -> AbstractProjectSetting:
        return self._project

    def iterGroups(self, root: str) -> Iterator[Group]:
        for group in self._phaseStructure.iterGroups(root):
            yield group

    def iterLatestThumbnailValues(self) -> Iterator[Value]:
        for value in self._sqLiteRepo.iterValues(parameter='latestThumbnail'):
            yield value

    def defaultThumbnail(self) -> QImage:
        return self._defaultThumbnail

    def valueLocationToGroupPath(self, value: Value) -> Optional[str]:
        locationParts = value.location().split('/')
        if locationParts[0] not in ('assets', 'shots'):
            return
        path = '/'.join(locationParts[0:-2])
        if not path:
            return
        return path

    def _createDefaultThumbnail(self) -> QImage:
        image = QImage(':/default_dark_128.png')
        size = image.size()
        croppedHeight = round(size.height() / 16 * 9)
        croppedTop = round((size.height() - croppedHeight) / 2)
        newRect = QRect(0, croppedTop, size.width(), croppedHeight)
        croppedImage = image.copy(newRect)
        dimImage = QImage(croppedImage.width(), croppedImage.height(), QImage.Format.Format_ARGB32)
        for w in range(croppedImage.width()):
            for h in range(croppedImage.height()):
                rgb = croppedImage.pixel(w, h)
                color = QColor.fromRgb(rgb).darker(133)
                dimImage.setPixel(w, h, color.rgb())
        return dimImage

    def getThumbnailPaths(
        self,
        value: Value,
    ) -> Optional[ThumbnailPaths]:
        tmbDir = self._project.publishDir() / str(value.location()) / '_tmb'
        if not tmbDir.is_dir():
            return
        revDir = tmbDir / str(value.value())
        if revDir.is_dir():
            return self._getThumbnailPaths(revDir)

    def _getThumbnailPaths(self, revDir: Path) -> Optional[ThumbnailPaths]:
        thumbDir = revDir / 'thumbnail'
        if not thumbDir.exists():
            return
        thumb: ThumbnailPaths = {}
        small = thumbDir / 'thumbnail_s.png'
        if small.exists():
            thumb['small'] = small
        medium = thumbDir / 'thumbnail_m.png'
        if medium.exists():
            thumb['medium'] = medium
        large = thumbDir / 'thumbnail_l.png'
        if large.exists():
            thumb['large'] = large
        animated = thumbDir / 'animated.gif'
        if animated.exists():
            thumb['animated'] = animated
        return thumb

    def threadStart(self, task: Task) -> None:
        self._threadPool.start(task)


class LoadThumbnailPathsTask(QObject):
    thumbnailPathsLoaded: Signal = Signal(str, dict)  # type: ignore

    def __init__(
        self,
        service: Service,
        value: Value,
    ) -> None:
        super().__init__()
        self._service = service
        self._value = value

    def run(self) -> None:
        thumbPaths = self._service.getThumbnailPaths(self._value)
        groupPath = self._service.valueLocationToGroupPath(self._value)
        if thumbPaths is None or groupPath is None:
            return
        self.thumbnailPathsLoaded.emit(groupPath, thumbPaths)


class LoadThumbnailTask(QObject):
    thumbnailLoaded: Signal = Signal(str, QImage)  # type: ignore

    def __init__(
        self,
        path: str,
        thumbPaths: ThumbnailPaths,
        size: str = 'small',
    ) -> None:
        super().__init__()
        self._path = path
        self._thumbPaths = thumbPaths
        self._size = size

    def run(self) -> None:
        _path = self._thumbPaths.get(self._size)
        if _path is None:
            return
        image = QImage(str(_path))
        self.thumbnailLoaded.emit(self._path, image)
