def _auth_header(client) -> dict[str, str]:
    response = client.post(
        "/auth/login",
        data={"username": "alice@example.com", "password": "password"},
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
