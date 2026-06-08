# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for Intelli IPS backend
# Run from inside the backend/ directory:
#   pyinstaller ips_backend.spec --clean

import sys
import os
from PyInstaller.utils.hooks import collect_all, collect_submodules

# ── Collect all sub-packages that PyInstaller misses for these libraries ──────
uvicorn_datas, uvicorn_binaries, uvicorn_hiddenimports = collect_all('uvicorn')
sklearn_datas, sklearn_binaries, sklearn_hiddenimports = collect_all('sklearn')
fastapi_datas, fastapi_binaries, fastapi_hiddenimports = collect_all('fastapi')

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[
        *uvicorn_binaries,
        *sklearn_binaries,
        *fastapi_binaries,
    ],
    datas=[
        # Include the local packages
        ('api', 'api'),
        ('engine', 'engine'),
        ('simulation', 'simulation'),
        ('models', 'models'),
        # Uvicorn / FastAPI collected data
        *uvicorn_datas,
        *sklearn_datas,
        *fastapi_datas,
    ],
    hiddenimports=[
        # ── uvicorn internals ─────────────────────────────────────────────────
        'uvicorn',
        'uvicorn.main',
        'uvicorn.config',
        'uvicorn.server',
        'uvicorn.logging',
        'uvicorn.lifespan.on',
        'uvicorn.lifespan.off',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.http.httptools_impl',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.protocols.websockets.websockets_impl',
        'uvicorn.protocols.websockets.wsproto_impl',
        'uvicorn.middleware.proxy_headers',
        *uvicorn_hiddenimports,

        # ── FastAPI / Starlette ───────────────────────────────────────────────
        'fastapi',
        'fastapi.middleware.cors',
        'fastapi.middleware',
        'starlette',
        'starlette.middleware.cors',
        'starlette.routing',
        'starlette.responses',
        'starlette.requests',
        'starlette.background',
        'starlette.concurrency',
        'anyio',
        'anyio.abc',
        'anyio._backends._asyncio',
        *fastapi_hiddenimports,

        # ── scikit-learn ──────────────────────────────────────────────────────
        'sklearn',
        'sklearn.ensemble',
        'sklearn.ensemble._iforest',
        'sklearn.tree',
        'sklearn.tree._classes',
        'sklearn.utils._cython_blas',
        'sklearn.utils._typedefs',
        'sklearn.utils._heap',
        'sklearn.utils._sorting',
        'sklearn.utils._vector_sentinel',
        'sklearn.neighbors._partition_nodes',
        'sklearn.utils.murmurhash',
        *sklearn_hiddenimports,

        # ── numpy / scipy internals ───────────────────────────────────────────
        'numpy',
        'numpy.core',
        'numpy.random',

        # ── standard library extras needed by uvicorn ─────────────────────────
        'h11',
        'click',
        'email.mime.text',
        'email.mime.multipart',

        # ── local packages ────────────────────────────────────────────────────
        'api',
        'api.simulation_routes',
        'api.ips_routes',
        'api.device_routes',
        'api.auth_routes',
        'engine',
        'engine.detector',
        'engine.mitigator',
        'simulation',
        'simulation.network',
        'simulation.traffic',
        'simulation.attacks',
        'models',
        'models.schemas',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'PIL', 'PyQt5', 'wx'],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='ips_backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,          # Keep True so uvicorn logs are visible in debug.log
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
