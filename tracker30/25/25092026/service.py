# --------------------------------------------------------------------------
# PPITRACKER-48: Service() used to build its default/placeholder thumbnail
# image synchronously during construction (_createDefaultThumbnail), which
# measured ~0.7-0.9s (mostly the QImage(':/default_dark_128.png') resource
# load; a smaller ~0.12s came from a per-pixel darkening loop, since
# replaced with a single QPainter composition). Service is now a QObject so
# it can emit defaultThumbnailChanged once the real thumbnail is built on a
# background thread - see LoadDefaultThumbnailTask below, and MainWindow's
# DataWidget._onDefaultThumbnailChanged for the caller side.
# --------------------------------------------------------------------------
from typing import Any, Iterator, Optional, Protocol, TypedDict

from PySide6.QtCore import QObject, QRect, QRunnable, QThreadPool, Signal
from PySide6.QtGui import QColor, QImage, QPainter

from ppilib.core.centralclient.pipelineParameter import CentralWebRepository, SQLiteRepository
from ppilib.core.entity.pipelineParameter import ListValueParams, Value
from ppilib.core.phase.structure2 import Group, PhaseStructure
from ppilib.core.pipelineParameter import PipelineParameterDelivery
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


class Service(QObject):  # PPITRACKER-48: was Service(object); QObject needed for the signal below
    defaultThumbnailChanged: Signal = Signal(QImage)  # type: ignore  # PPITRACKER-48 (new)

    def __init__(self, pipelineSetting: DesktopPipelineSetting) -> None:
        super().__init__()
        self._pipelineSetting = pipelineSetting
        project = pipelineSetting.project()
        assert project is not None
        self._project = project
        self._phaseStructure = PhaseStructure(self._pipelineSetting)
        self._parameterDelivery = PipelineParameterDelivery(self._pipelineSetting)
        self._sqLiteRepo = SQLiteRepository(pipelineSetting)
        self._centralWebRepo = CentralWebRepository(pipelineSetting)
        self._useCentralWeb = False
        self._pipelineParameterKeysById: dict[str, str] | None = None
        self._pipelineParameterValueCache: dict[str, dict[str, Any]] = {}
        self._localPipelineParameterValues: dict[str, dict[str, Any]] = {}
        self._threadPool = ThreadPool()
        # PPITRACKER-48: A cheap, resource-free placeholder is used immediately; the actual
        # styled dark thumbnail (cropping + darkening ':/default_dark_128.png')
        # is built off the main thread and swapped in via defaultThumbnailChanged
        # once ready, since loading that resource measured ~0.7-0.9s and was
        # blocking window startup.
        self._defaultThumbnail = self._createFallbackThumbnail()
        self._defaultThumbnailTask: Optional['LoadDefaultThumbnailTask'] = None
        self._loadStyledDefaultThumbnailAsync()

    def _createFallbackThumbnail(self) -> QImage:
        image = QImage(128, 72, QImage.Format.Format_ARGB32)
        image.fill(QColor(45, 45, 45))
        return image

    def _loadStyledDefaultThumbnailAsync(self) -> None:
        task = LoadDefaultThumbnailTask()
        task.thumbnailReady.connect(self._onStyledDefaultThumbnailReady)
        self._defaultThumbnailTask = task
        self._threadPool.start(task)

    def _onStyledDefaultThumbnailReady(self, image: QImage) -> None:
        self._defaultThumbnailTask = None
        self._defaultThumbnail = image
        self.defaultThumbnailChanged.emit(image)

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

    def pipelineParameterValue(self, location: str, parameter: str) -> Any:
        return self._parameterDelivery.value(location, parameter)

    def setUseCentralWebRepository(self, enabled: bool) -> None:
        if self._useCentralWeb == enabled:
            return
        self._useCentralWeb = enabled
        self._pipelineParameterKeysById = None
        self.clearPipelineParameterValueCache()

    def useCentralWebRepository(self) -> bool:
        return self._useCentralWeb

    def _pipelineParameterRepository(self):
        return self._centralWebRepo if self._useCentralWeb else self._sqLiteRepo

    def pipelineParameterKey(self, parameterIndex: Any) -> str | None:
        if self._pipelineParameterKeysById is None:
            repository = self._pipelineParameterRepository()
            self._pipelineParameterKeysById = {
                str(parameter.id()): parameter.keyName()
                for parameter in repository.iterParameters()
            }
        return self._pipelineParameterKeysById.get(str(parameterIndex))

    def pipelineParameterValues(self, parameter: str) -> dict[str, Any]:
        if parameter in self._pipelineParameterValueCache:
            return self._pipelineParameterValueCache[parameter]

        if self._useCentralWeb:
            params = ListValueParams(parameter, None, self._project.keyName())
            iterator = self._centralWebRepo.iterValues(params)
        else:
            iterator = self._sqLiteRepo.iterValues(parameter=parameter)

        values = {
            str(value.location()).strip('/'): value.value()
            for value in iterator
        }
        self._pipelineParameterValueCache[parameter] = values
        return values

    def localPipelineParameterValues(self, parameter: str) -> dict[str, Any]:
        if parameter not in self._localPipelineParameterValues:
            self._localPipelineParameterValues[parameter] = {
                str(value.location()).strip('/'): value.value()
                for value in self._sqLiteRepo.iterValues(parameter=parameter)
            }
        return self._localPipelineParameterValues[parameter]

    def localPipelineParameterValue(self, location: str, parameter: str) -> Any:
        normalizedLocation = location.strip('/')
        return self.localPipelineParameterValues(parameter).get(normalizedLocation)

    def clearPipelineParameterValueCache(self) -> None:
        self._pipelineParameterValueCache.clear()
        self._localPipelineParameterValues.clear()

    def valueLocationToGroupPath(self, value: Value) -> Optional[str]:
        locationParts = value.location().split('/')
        if locationParts[0] not in ('assets', 'shots'):
            return
        path = '/'.join(locationParts[0:-2])
        if not path:
            return
        return path

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


class LoadDefaultThumbnailTask(QObject):  # PPITRACKER-48 (new)
    """Builds the styled default/placeholder thumbnail off the main thread.

    QImage (unlike QPixmap) is safe to construct and paint into from a
    non-GUI thread, so this can run entirely on a QThreadPool worker.
    """

    thumbnailReady: Signal = Signal(QImage)  # type: ignore

    def run(self) -> None:
        image = QImage(':/default_dark_128.png')
        size = image.size()
        croppedHeight = round(size.height() / 16 * 9)
        croppedTop = round((size.height() - croppedHeight) / 2)
        newRect = QRect(0, croppedTop, size.width(), croppedHeight)
        croppedImage = image.copy(newRect).convertToFormat(QImage.Format.Format_ARGB32)

        # Equivalent darkening to the old per-pixel QColor(...).darker(133)
        # loop, done as a single Qt paint composition instead of ~9,200
        # individual pixel()/setPixel() Python<->Qt round-trips.
        darkenAlpha = round(255 * (1 - 100 / 133))
        painter = QPainter(croppedImage)
        painter.setCompositionMode(QPainter.CompositionMode.CompositionMode_SourceOver)
        painter.fillRect(croppedImage.rect(), QColor(0, 0, 0, darkenAlpha))
        painter.end()

        self.thumbnailReady.emit(croppedImage)


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
