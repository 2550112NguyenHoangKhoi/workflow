from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import json

def get_workspace_path():
    config_path = os.path.expanduser("~/.omilearn_config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, "r") as f:
                data = json.load(f)
                return data.get("workspace_path")
        except:
            pass
    return None

workspace = get_workspace_path()
if workspace:
    # Ensure directory exists
    os.makedirs(workspace, exist_ok=True)
    db_path = os.path.join(workspace, "omilearn_local.db")
    # SQLAlchemy requires an absolute path to use 4 slashes on Windows, or standard URI.
    # For SQLite, absolute path is sqlite:////absolute/path/to/file.db
    # On Windows, os.path.abspath might have C:\ which SQLite handles via sqlite:///C:/...
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{os.path.abspath(db_path)}"
else:
    SQLALCHEMY_DATABASE_URL = "sqlite:///./omilearn_local.db"
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
