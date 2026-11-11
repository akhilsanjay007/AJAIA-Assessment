from pathlib import Path

from fastapi.testclient import TestClient

import app.main as main


def test_browser_routes_serve_the_spa_and_api_routes_stay_json(tmp_path: Path, monkeypatch):
    index = tmp_path / "index.html"
    index.write_text('<!doctype html><div id="root"></div>', encoding="utf-8")
    monkeypatch.setattr(main, "INDEX_FILE", index)
    monkeypatch.setattr(main, "STATIC_DIR", tmp_path)

    with TestClient(main.app) as client:
        home = client.get("/")
        assert home.status_code == 200
        assert 'id="root"' in home.text

        page = client.get("/documents/1", headers={"Accept": "text/html"})
        assert page.status_code == 200
        assert 'id="root"' in page.text

        listing = client.get("/documents")
        assert listing.status_code == 401
        assert listing.json()["detail"] == "Not authenticated"

        health = client.get("/health", headers={"Accept": "text/html"})
        assert health.status_code == 200
        assert health.json() == {"status": "ok"}
