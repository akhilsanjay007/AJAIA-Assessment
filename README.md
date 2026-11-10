# Document Editor

A small FastAPI and React document editor. Sign in with a seeded account, write with TipTap, share a document with another seeded user, or create a document from a `.txt` or `.md` file.

## Layout

- `backend/` — FastAPI, SQLAlchemy, and SQLite (`docs.db`)
- `frontend/` — React, TypeScript, Vite, Tailwind, and TipTap

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

If you already have a `docs.db` from an older schema, delete it and run `seed.py` again. Tables are created on startup, but existing files are not migrated.

- `GET /health` returns `{"status": "ok"}`
- `POST /auth/login` accepts form fields `username` and `password` and returns an access token plus the user
- `GET /documents` returns the current user's documents and documents shared with them
- `POST /documents` and `PUT /documents/{id}` create and update owned documents. Content is HTML.
- `POST /documents/{id}/share` shares an owned document by email
- `POST /documents/upload` creates a document from a `.txt` or `.md` file

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

## More detail

- [ARCHITECTURE.md](ARCHITECTURE.md) — how the pieces fit and which tradeoffs were chosen
- [AI_WORKFLOW.md](AI_WORKFLOW.md) — how AI was used
- [SUBMISSION.md](SUBMISSION.md) — what is included, what is not, and the seeded credentials
