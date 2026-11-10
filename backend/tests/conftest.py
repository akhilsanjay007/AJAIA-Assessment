import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Set before importing the app so the engine binds to an isolated database.
os.environ["DATABASE_URL"] = "sqlite://"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import User


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.add(User(email="alice@example.com", name="Alice", password="password"))
        db.add(User(email="bob@example.com", name="Bob", password="password"))
        db.add(User(email="charlie@example.com", name="Charlie", password="password"))
        db.commit()
    finally:
        db.close()
    yield
    engine.dispose()


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client
