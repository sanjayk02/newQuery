import logging
import logging.config
import sys
from logging import getLogger
from typing import Any, Dict, cast  # noqa: F401

from ppilib.core.launcher import AppInfo
from ppilib.desktop.setting import DesktopPipelineSetting, DesktopSectionManager
from ppilib.utils.compat.pathlib import Path
from ppui.desktop.style import default

from .__version__ import __version__
from .application import Application
from .mainWindow import MainWindow
from .state import State
from .uilib import excepthook

_logger = getLogger(__name__)


def constructLogConfig(level: str, path: Any) -> Dict[str, Any]:
    """Logファイル出力の設定を返す。

    `version`: 指定できる値は1のみ。今後のバージョンアップ時の後方互換性確保のための項目。

    `disable_existing_loggers`: boolで指定する。
    dictConfig()実行時に、すでに存在する Loggerと同名の Loggerを設定しようとした際の挙動を指定する。
        `True`: 既存の Loggerと同名の新規 Loggerを使用不可にする。
        `False`: 既存の Loggerを上書きして新規 Loggerとして使用可能にする。

    `formatters`: ログ出力の際にどのような情報を、
    どういったフォーマットで出力するかのフォーマッタの種類を列挙する。
        `%(levelname)s`: ログレベル ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')
        `%(asctime)s`: ログ生成日時 "yyyy-mm-dd HH:MM:SS,sss"
        `%(process)d`: プロセス ID
        `%(name)s`: ロギングに使われたロガーの名前
        `%(message)s`: 呼び出し時に引数で指定した値(logger.info("ここ"))
        `%(pathname)s`: ロギングの呼び出しが発せられたファイルの完全なパス名
        `%(funcName)s`: 呼び出し元関数名
        `%(lineno)d`: 呼び出し元ファイル内の行番号

    `handlers`: 各ロガーがログをどのように扱うかといったハンドラーの種類を列挙する。
        `class`: ハンドラーのクラスを指定する。
            `RotatingFileHandler`: logファイルに出力。
            `StreamHandler`: コンソール等に標準出力。
        `formatter`: ログ出力フォーマットを規定するフォーマッタを指定する。
        `filename`: 作成する logファイル名。
        `maxBytes`: logファイルの最大ファイルサイズを指定する。
        指定サイズを超えたら自動的に新しいログファイルが作成される。
        `backupCount`: ファイルを作成する回数。

    `root`: rootロガーの設定
        `level`: ログレベルを定義する。
        `handlers`: ロガーが使用するログハンドラーを指定する。
    """
    return {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'readable': {
                'format': (
                    '[%(levelname)s][%(asctime)s][%(process)d]%(name)s: %(message)s '
                    '(%(pathname)s:%(funcName)s:%(lineno)d)'
                ),
            },
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'formatter': 'readable',
            },
            'file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'formatter': 'readable',
                'filename': path.as_posix(),
                'maxBytes': 1024 * 1024 * 10,
                'backupCount': 10,
            },
        },
        'root': {
            'level': level,
            'handlers': ['console', 'file'],
        },
    }


def setupLogging(debug: bool, homePath: Path) -> None:
    logPath = homePath / '.ppip30/ppiBreakdown/log/ppiTracker.log'
    logPath.parent.mkdir(parents=True, exist_ok=True)
    logLevel = 'DEBUG' if debug else 'INFO'
    logConfig = constructLogConfig(level=logLevel, path=logPath)
    logging.config.dictConfig(logConfig)
    logging.raiseExceptions = debug


def launch() -> int:
    import time
    _t0 = time.perf_counter()

    def _mark(label: str) -> None:
        print(f'[TIMING] {label}: {time.perf_counter() - _t0:.2f}s elapsed')

    appInfo = AppInfo(
        displayName='PPI Breakdown',
        version=__version__,
        iconName=':/ppitools/ppiBreakdown.png',
        repoName='tracker30',
        package=__package__,
        modules=('ppiTracker', 'ppilib', 'ppui'),
        id='',
    )

    app = Application(appInfo, sys.argv)
    default.setStyle(app)
    _mark('Application created')

    with excepthook(appInfo.displayName()):
        sectionManager = DesktopSectionManager()
        _mark('DesktopSectionManager created')

        # Logging
        debug = '--debug' in sys.argv
        setupLogging(debug, sectionManager.bootstrapConf().userRootDir())
        _mark('setupLogging done')

        pipelineSetting = cast(DesktopPipelineSetting, sectionManager.pipelineSetting())
        _mark('pipelineSetting resolved')
        project = pipelineSetting.project()
        assert project is not None, 'No project selected in pipeline setting.'
        projectName = project.displayName()
        _mark('project resolved')

        state = State(sectionManager, debug)
        _mark('State() constructed')
        win = MainWindow(appInfo, state, debug)
        _mark('MainWindow() constructed')
        title = '[%s] %s (v%s)' % (
            (projectName if projectName else 'No Project'),
            appInfo.displayName(),
            appInfo.version(),
        )
        win.setWindowTitle(title)
        _logger.debug('Launching application: %s', title)
        win.show()
        _mark('win.show() called')

        return app.exec()
