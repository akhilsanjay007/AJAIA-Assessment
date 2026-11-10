# Document Editor

Phase 0 of a FastAPI and React document editor: JWT login, a SQLite user store, and a Vite login page.

## Layout

- `backend/` — FastAPI, SQLAlchemy, and SQLite (`docs.db`)
- `frontend/` — React, TypeScript, Vite, and Tailwind

The Vite dev server proxies `/api` to `http://localhost:8000` and strips the `/api` prefix.

## Demo accounts

| Email | Password |
| --- | --- |
| alice@example.com | password |
| bob@example.com | password |
| charlie@example.com | password |

Passwords are stored in plain text for this demo.

## Backend

From `backend/`:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python seed.py
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

- `GET /health` returns `{"status": "ok"}`
- `POST /auth/login` accepts form fields `username` and `password` and returns an access token plus the user

Run tests from `backend/`:

```powershell
.\.venv\Scripts\python -m pytest
```

## Frontend

From `frontend/`:

```powershell
npm install
npm run dev
```

Open http://localhost:5173 and sign in with a demo account. The API must be running on port 8000.
