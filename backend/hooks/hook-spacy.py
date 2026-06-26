from PyInstaller.utils.hooks import collect_submodules, collect_data_files

hiddenimports = []
for pkg in ["spacy", "thinc", "catalogue", "cymem", "murmurhash", "preshed", "srsly", "blis"]:
    hiddenimports += collect_submodules(pkg)

datas = []
for pkg in ["spacy", "spacy.lang", "thinc", "catalogue", "cymem", "murmurhash", "preshed", "srsly", "blis"]:
    try:
        datas += collect_data_files(pkg, include_py_files=True)
    except Exception:
        pass
