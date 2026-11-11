# Document Editor

A small FastAPI and React document editor. Sign in with a seeded account, write with TipTap, share a document as view or edit, export Markdown, look through recent saves, or create a document from a `.txt` or `.md` file.

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

If you already have a `docs.db` from an older schema, delete it and run `seed.py` again. Tables are created on startup, but existing files are not migrated. The share permission column is one of those changes, so an older database will not grow it in place.

- `GET /health` returns `{"status": "ok"}`
- `POST /auth/login` accepts form fields `username` and `password` and returns an access token plus the user
- `GET /documents` returns the current user's documents and documents shared with them. A shared row includes `can_edit`.
- `POST /documents` and `PUT /documents/{id}` create and update documents. Content is HTML. An update is allowed for the owner and for anyone shared with edit access, and each update stores a snapshot.
- `GET /documents/{id}/versions` returns the last 10 snapshots for anyone who can open the document. Each snapshot has the title, HTML, saver, and time.
- `POST /documents/{id}/versions/{version_id}/restore` copies a snapshot back onto the document. That restore is itself a new snapshot. Viewers cannot restore.
- `POST /documents/{id}/share` shares an owned document by email. The body may include `permission` of `view` or `edit`. Sharing the same person again updates that permission.
- `GET /documents/{id}/shares` lists email, name, and permission for the owner.
- `POST /documents/{id}/presence` records that the current user has the document open. `DELETE /documents/{id}/presence` clears that row. `GET /documents/{id}/presence` returns people seen in the last 20 seconds.
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

On an open document, Export downloads the current HTML as a `.md` file named from the title. Underline is exported as `<u>`. History lists the last 10 saves, opens one read-only, and can restore it when you have edit access. The share form chooses Can view or Can edit and lists people the document is already shared with. The header shows who else has the document open. That list is polled about every 8 seconds, so it can lag by one poll. Two people with edit access still overwrite each other on save.

## Deployment

The backend deploys to Railway. The frontend deploys to Vercel, or to Railway as a second service. Local `npm run dev` and uvicorn are unchanged: leave `VITE_API_URL` unset and the Vite dev server still proxies `/api` to port 8000.

Two Railway variables are required:

- **Frontend `VITE_API_URL`** — the backend origin only, including `https://`, with no path and no trailing slash. A host without a scheme is treated as `https://`. Vite inlines this at build time, so set it before the frontend build and redeploy after changing it. Login then calls `{VITE_API_URL}/auth/login`.
- **Backend `CORS_ORIGINS`** — the frontend origin, for example the frontend Railway URL. Separate extra origins with commas. `http://localhost:5173` and `http://127.0.0.1:5173` are always allowed.

### Backend on Railway

Create a service from this repo with the root directory set to `backend`. Start command:

```bash
python seed.py && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

`seed.py` only inserts the demo users when they are missing, so it is safe to run on each boot. Tables are created when the API starts.

Attach the Postgres plugin if you want Postgres. Railway sets `DATABASE_URL` as `postgres://...`, and the app rewrites that to `postgresql://` for SQLAlchemy. With no `DATABASE_URL`, the app uses SQLite at `sqlite:///./docs.db`.

Set `SECRET_KEY` to a long random string. Set `CORS_ORIGINS` to the frontend origin, for example `https://your-app.vercel.app`. `http://localhost:5173` and `http://127.0.0.1:5173` are always allowed. There is also a commented placeholder in `backend/app/main.py`.

### Frontend on Vercel

Set the project root to `frontend`, the framework to Vite, the build command to `npm run build`, and the output directory to `dist`.

Set `VITE_API_URL` to the Railway backend URL with no trailing slash, for example `https://your-service.up.railway.app`. Vite reads that variable at build time. `frontend/.env.production` has the same placeholder for a local production build. Do not set it for `npm run dev`.

### Frontend on Railway

Use a second service with root directory `frontend`. Set `VITE_API_URL` to the backend URL before the build, then serve the `dist` folder. The same placeholder rules apply.

## More detail

- [ARCHITECTURE.md](ARCHITECTURE.md) — how the pieces fit and which tradeoffs were chosen
- [AI_WORKFLOW.md](AI_WORKFLOW.md) — how AI was used
- [SUBMISSION.md](SUBMISSION.md) — what is included, what is not, and the seeded credentials
