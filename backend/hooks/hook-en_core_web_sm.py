from PyInstaller.utils.hooks import collect_data_files
import en_core_web_sm

hiddenimports = ["en_core_web_sm"]
datas = collect_data_files("en_core_web_sm", include_py_files=True)
