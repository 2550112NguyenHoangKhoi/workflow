import os
from PyInstaller.utils.hooks import collect_submodules, collect_data_files
from PyInstaller.building.datastruct import Tree
from PyInstaller.building.build_main import Analysis, PYZ, EXE, COLLECT

block_cipher = None

spacy_hidden = []
for pkg in [
    "spacy", "thinc", "catalogue", "cymem", "murmurhash", "preshed",
    "srsly", "blis", "spacy_legacy", "spacy_loggers"
]:
    spacy_hidden += collect_submodules(pkg)

datas = []
for pkg in [
    "spacy", "spacy.lang", "thinc", "catalogue", "cymem",
    "murmurhash", "preshed", "srsly", "blis", "spacy_legacy", "spacy_loggers",
    "en_core_web_sm", "nltk"
]:
    try:
        datas += collect_data_files(pkg, include_py_files=True)
    except Exception:
        pass

# Bundle NLTK data from the user's home directory
nltk_data_path = os.path.expanduser('~/nltk_data')
if os.path.exists(nltk_data_path):
    datas += [(nltk_data_path, "nltk_data")]

a = Analysis(
    ["main.py"],
    pathex=["."],
    binaries=[],
    datas=datas,
    hiddenimports=spacy_hidden + [
        "spacy.matcher._schemas",
        "spacy.tokens._retokenize",
        "spacy.tokens.morphanalysis",
        "spacy.tokens.underscore",
        "spacy.syntax.arc_eager",
        "spacy.syntax.nn_parser",
        "spacy.syntax.transition_system",
        "spacy.syntax.stateclass",
        "spacy.syntax._parser_model",
        "spacy.syntax._beam_utils",
        "spacy.parts_of_speech",
        "spacy.morphology",
        "spacy.kb",
        "spacy.lexeme",
        "pytextrank",
        "nltk.corpus",
        "nltk.stem",
        "nltk.tokenize",
        "sklearn",
        "networkx",
        "sqlalchemy",
    ],
    hookspath=["hooks"],
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="workflow-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    name="workflow-backend",
)
