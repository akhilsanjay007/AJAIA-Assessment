def test_login_success(client):
    response = client.post(
        "/auth/login",
        data={"username": "alice@example.com", "password": "password"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert isinstance(body["access_token"], str) and body["access_token"]
    assert body["user"]["email"] == "alice@example.com"
    assert body["user"]["name"] == "Alice"
    assert "password" not in body["user"]


def test_login_invalid_password(client):
    response = client.post(
        "/auth/login",
        data={"username": "alice@example.com", "password": "wrong-password"},
    )
    assert response.status_code == 401


def test_login_unknown_user(client):
    response = client.post(
        "/auth/login",
        data={"username": "nobody@example.com", "password": "password"},
    )
    assert response.status_code == 401
