# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the Online Garage OBD Bridge Windows tray app.

Builds a windowed (console=False), onedir application from
windows_tray_app.py -- see that file's module docstring for the tray/server
architecture. Produces:

    obd_reader/dist/OnlineGarageOBDBridge/OnlineGarageOBDBridge.exe

Build with (from the repo root):
    powershell -ExecutionPolicy Bypass -File scripts/build_obd_bridge.ps1

or directly:
    python -m PyInstaller obd_reader/OnlineGarageOBDBridge.spec

Kept deliberately minimal. FastAPI, Uvicorn, pystray, and Pillow all
already ship PyInstaller hooks (via PyInstaller itself and the
pyinstaller-hooks-contrib package installed alongside it) that correctly
collect their dynamic imports -- pystray's platform backend selection,
Uvicorn's protocol/loop auto-selection, Pillow's image plugins -- so no
manual hidden imports are declared for those. `local_bridge` and `reader`
are the only explicit hiddenimports, added only because obd_reader/ is a
flat, package-less directory (no __init__.py) using bare sibling imports;
everything else is left to PyInstaller's normal static analysis rather
than pre-emptively bundling the whole environment.
"""

import os

block_cipher = None

APP_NAME = "OnlineGarageOBDBridge"
# SPECPATH is injected by PyInstaller into the spec file's exec namespace
# and always points at the directory containing this .spec file, so the
# build works the same regardless of the caller's current directory.
OBD_READER_DIR = SPECPATH  # noqa: F821

a = Analysis(  # noqa: F821
    [os.path.join(OBD_READER_DIR, "windows_tray_app.py")],
    pathex=[OBD_READER_DIR],
    binaries=[],
    datas=[],
    hiddenimports=[
        "local_bridge",
        "reader",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    cipher=block_cipher,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)  # noqa: F821

exe = EXE(  # noqa: F821
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name=APP_NAME,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(  # noqa: F821
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name=APP_NAME,
)
