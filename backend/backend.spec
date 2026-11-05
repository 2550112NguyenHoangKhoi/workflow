import os
from PyInstaller.utils.hooks import collect_submodules, collect_data_files, collect_all
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

binaries = []
extra_hidden = []
# Packages that ship native binaries / data files or import submodules dynamically.
# google.antigravity bundles the `localharness` executable it spawns at runtime.
# litert_lm bundles the LiteRT-LM native library (liblitert-lm.dylib with Metal on macOS;
# litert-lm.dll + dxcompiler/dxil + OpenVINO NPU dispatch on Windows).
for pkg in ["google.antigravity", "litert_lm", "google.genai", "uvicorn", "ddgs", "pyvi", "trafilatura",
            "youtube_transcript_api", "deep_translator", "docx", "pdfplumber", "certifi"]:
    try:
        d, b, h = collect_all(pkg)
        datas += d
        binaries += b
        extra_hidden += h
    except Exception:
        pass

# NLTK data: the repo copy (wordnet) plus anything in the builder's ~/nltk_data.
repo_nltk = os.path.abspath("nltk_data")
if os.path.exists(repo_nltk):
    datas += [(repo_nltk, "nltk_data")]
nltk_data_path = os.path.expanduser('~/nltk_data')
if os.path.exists(nltk_data_path):
    datas += [(nltk_data_path, "nltk_data")]

a = Analysis(
    ["main.py"],
    pathex=["."],
    binaries=binaries,
    datas=datas,
    hiddenimports=spacy_hidden + extra_hidden + [
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
        "sqlalchemy.orm",
        "sqlalchemy.ext.declarative",
        "sqlalchemy.orm.sessionmaker",
        "pyvi",
        "en_core_web_sm",
    ] + collect_submodules("nlp") + collect_submodules("db") + collect_submodules("core"),
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
