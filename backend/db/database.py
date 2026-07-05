from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import json

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

workspace = get_workspace_path()
if workspace:
    # Ensure directory exists
    os.makedirs(workspace, exist_ok=True)
    db_path = resolve_db_path(workspace)
    # SQLAlchemy requires an absolute path to use 4 slashes on Windows, or standard URI.
    # For SQLite, absolute path is sqlite:////absolute/path/to/file.db
    # On Windows, os.path.abspath might have C:\ which SQLite handles via sqlite:///C:/...
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{os.path.abspath(db_path)}"
else:
    SQLALCHEMY_DATABASE_URL = f"sqlite:///./{os.path.basename(resolve_db_path('.'))}"
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
