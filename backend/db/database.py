from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import sys
import json
import shutil

DB_NAME = "workflow_local.db"
LEGACY_DB_NAME = "omilearn_local.db"  # pre-rebrand name; migrated on first boot

def get_workspace_path():
    # Prefer the new config; fall back to the legacy one so existing installs keep working.
    for candidate in ("~/.workflow_config.json", "~/.omilearn_config.json"):
        config_path = os.path.expanduser(candidate)
        if os.path.exists(config_path):
            try:
                with open(config_path, "r") as f:
                    data = json.load(f)
                    return data.get("workspace_path")
            except:
                pass
    return None

def resolve_db_path(directory):
    """Return the DB path inside `directory`, renaming a legacy-named DB if one is present."""
    new_path = os.path.join(directory, DB_NAME)
    legacy_path = os.path.join(directory, LEGACY_DB_NAME)
    if not os.path.exists(new_path) and os.path.exists(legacy_path):
        try:
            os.rename(legacy_path, new_path)
        except OSError:
            return legacy_path
    return new_path

def get_data_dir():
    """Where user data (DB, uploaded files, usage counter) lives.

    1. the workspace folder chosen in the app (~/.workflow_config.json)
    2. WORKFLOW_DATA_DIR (Electron passes app.getPath('userData'))
    3. ~/.workflow for a frozen build (the bundle itself may be read-only)
    4. the backend/ folder when running from source
    """
    workspace = get_workspace_path()
    if workspace:
        return workspace
    env_dir = os.getenv("WORKFLOW_DATA_DIR")
    if env_dir:
        return env_dir
    if getattr(sys, "frozen", False):
        return os.path.join(os.path.expanduser("~"), ".workflow")
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _migrate_legacy_frozen_data(data_dir):
    """Older packaged builds kept the DB in the process cwd (the app's resources folder)
    and uploads next to the executable. Copy them into data_dir once, never overwrite."""
    if not getattr(sys, "frozen", False):
        return
    candidates = {os.getcwd(), os.path.dirname(sys.executable), getattr(sys, "_MEIPASS", "")}
    for base in filter(None, candidates):
        for name in (DB_NAME, LEGACY_DB_NAME):
            src = os.path.join(base, name)
            if os.path.isfile(src) and not os.path.exists(os.path.join(data_dir, DB_NAME)):
                shutil.copy2(src, os.path.join(data_dir, DB_NAME))
        src_uploads = os.path.join(base, "uploads")
        dst_uploads = os.path.join(data_dir, "uploads")
        if os.path.isdir(src_uploads) and not os.path.exists(dst_uploads):
            shutil.copytree(src_uploads, dst_uploads)


DATA_DIR = os.path.abspath(get_data_dir())
os.makedirs(DATA_DIR, exist_ok=True)
try:
    _migrate_legacy_frozen_data(DATA_DIR)
except OSError as e:
    print(f"[db] legacy data migration skipped: {e}")

UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
USAGE_FILE = os.path.join(DATA_DIR, "usage.json")
db_path = resolve_db_path(DATA_DIR)
# Absolute path -> sqlite:////abs/path (POSIX) or sqlite:///C:\... (Windows); both work.
SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_path}"
print(f"[db] data dir: {DATA_DIR}")
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
