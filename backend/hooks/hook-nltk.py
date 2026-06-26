from PyInstaller.utils.hooks import collect_data_files, collect_submodules

hiddenimports = collect_submodules("nltk")
datas = collect_data_files("nltk", include_py_files=True)
