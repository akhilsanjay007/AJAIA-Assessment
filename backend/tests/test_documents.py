from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.database import SessionLocal
from app.models import DocumentPresence


def _auth_header(client, email: str = "alice@example.com") -> dict[str, str]:
    response = client.post(
        "/auth/login",
        data={"username": email, "password": "password"},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_create_and_list_document(client):
    headers = _auth_header(client)
    created = client.post(
        "/documents",
        json={"title": "Meeting notes", "content": "<p>Hello</p>"},
        headers=headers,
    )
    assert created.status_code == 201
    assert created.json()["title"] == "Meeting notes"

    listed = client.get("/documents", headers=headers)
    assert listed.status_code == 200
    owned = listed.json()["owned"]
    assert any(document["title"] == "Meeting notes" for document in owned)
    assert listed.json()["shared"] == []


def test_version_history_lists_saves_and_restores(client):
    headers = _auth_header(client)
    created = client.post(
        "/documents",
        json={"title": "Draft", "content": "<p>start</p>"},
        headers=headers,
    )
    assert created.status_code == 201
    document_id = created.json()["id"]

    first = client.put(
        f"/documents/{document_id}",
        json={"title": "Draft", "content": "<p>one</p>"},
        headers=headers,
    )
    second = client.put(
        f"/documents/{document_id}",
        json={"title": "Revised", "content": "<p>two</p>"},
        headers=headers,
    )
    assert first.status_code == 200
    assert second.status_code == 200

    listed = client.get(f"/documents/{document_id}/versions", headers=headers)
    assert listed.status_code == 200
    versions = listed.json()
    assert len(versions) == 2
    assert versions[0]["content"] == "<p>two</p>"
    assert versions[0]["title"] == "Revised"
    assert versions[0]["saved_by_name"] == "Alice"
    assert versions[1]["content"] == "<p>one</p>"

    restored = client.post(
        f"/documents/{document_id}/versions/{versions[1]['id']}/restore",
        headers=headers,
    )
    assert restored.status_code == 200
    assert restored.json()["content"] == "<p>one</p>"
    assert restored.json()["title"] == "Draft"

    again = client.get(f"/documents/{document_id}/versions", headers=headers)
    assert len(again.json()) == 3
    assert again.json()[0]["content"] == "<p>one</p>"


def test_version_history_keeps_the_latest_ten(client):
    headers = _auth_header(client)
    created = client.post(
        "/documents",
        json={"title": "Log", "content": "<p></p>"},
        headers=headers,
    )
    document_id = created.json()["id"]
    for index in range(11):
        saved = client.put(
            f"/documents/{document_id}",
            json={"title": "Log", "content": f"<p>{index}</p>"},
            headers=headers,
        )
        assert saved.status_code == 200

    listed = client.get(f"/documents/{document_id}/versions", headers=headers)
    versions = listed.json()
    assert [version["content"] for version in versions] == [f"<p>{index}</p>" for index in range(10, 0, -1)]


def test_presence_shows_recent_viewers_only(client):
    headers = _auth_header(client)
    created = client.post(
        "/documents",
        json={"title": "Live", "content": "<p></p>"},
        headers=headers,
    )
    document_id = created.json()["id"]

    first = client.post(f"/documents/{document_id}/presence", headers=headers)
    second = client.post(f"/documents/{document_id}/presence", headers=headers)
    assert first.status_code == 204
    assert second.status_code == 204

    present = client.get(f"/documents/{document_id}/presence", headers=headers)
    assert present.status_code == 200
    assert [person["email"] for person in present.json()] == ["alice@example.com"]

    db = SessionLocal()
    try:
        row = db.scalar(select(DocumentPresence).where(DocumentPresence.document_id == document_id))
        assert row is not None
        row.last_seen = datetime.now(timezone.utc) - timedelta(seconds=60)
        db.commit()
    finally:
        db.close()

    stale = client.get(f"/documents/{document_id}/presence", headers=headers)
    assert stale.json() == []

    again = client.post(f"/documents/{document_id}/presence", headers=headers)
    assert again.status_code == 204
    left = client.delete(f"/documents/{document_id}/presence", headers=headers)
    assert left.status_code == 204
    gone = client.get(f"/documents/{document_id}/presence", headers=headers)
    assert gone.json() == []


def test_share_view_and_edit_permissions(client):
    alice = _auth_header(client)
    bob = _auth_header(client, "bob@example.com")
    created = client.post(
        "/documents",
        json={"title": "Shared notes", "content": "<p>original</p>"},
        headers=alice,
    )
    assert created.status_code == 201
    document_id = created.json()["id"]

    shared = client.post(
        f"/documents/{document_id}/share",
        json={"email": "bob@example.com", "permission": "view"},
        headers=alice,
    )
    assert shared.status_code == 200
    assert shared.json()["detail"] == "Document shared"

    listed = client.get("/documents", headers=bob)
    visible = next(item for item in listed.json()["shared"] if item["id"] == document_id)
    assert visible["can_edit"] is False

    denied = client.put(
        f"/documents/{document_id}",
        json={"title": "Shared notes", "content": "<p>changed</p>"},
        headers=bob,
    )
    assert denied.status_code == 403

    denied_restore = client.post(f"/documents/{document_id}/versions/1/restore", headers=bob)
    assert denied_restore.status_code == 403

    opened = client.get(f"/documents/{document_id}", headers=bob)
    assert opened.json()["can_edit"] is False
    assert opened.json()["content"] == "<p>original</p>"

    blocked_share = client.post(
        f"/documents/{document_id}/share",
        json={"email": "charlie@example.com", "permission": "edit"},
        headers=bob,
    )
    assert blocked_share.status_code == 403

    upgraded = client.post(
        f"/documents/{document_id}/share",
        json={"email": "bob@example.com", "permission": "edit"},
        headers=alice,
    )
    assert upgraded.status_code == 200
    assert upgraded.json()["detail"] == "Permission updated to edit"

    grants = client.get(f"/documents/{document_id}/shares", headers=alice)
    assert grants.status_code == 200
    assert grants.json() == [
        {"email": "bob@example.com", "name": "Bob", "permission": "edit"}
    ]

    saved = client.put(
        f"/documents/{document_id}",
        json={"title": "Shared notes", "content": "<p>bob edit</p>"},
        headers=bob,
    )
    assert saved.status_code == 200
    assert saved.json()["content"] == "<p>bob edit</p>"
    assert saved.json()["can_edit"] is True

    hidden = client.get(f"/documents/{document_id}/shares", headers=bob)
    assert hidden.status_code == 403
