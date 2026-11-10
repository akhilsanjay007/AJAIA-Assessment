# Submission

## Included

- FastAPI backend, SQLite, and seeded JWT login
- React, Vite, TypeScript, and Tailwind client
- Document create, list, open, and update
- TipTap editor with bold, italic, underline, headings H1–H3, bullet list, and numbered list
- HTML content that is saved and loaded again
- Owner-only sharing by email
- Dashboard sections for “My documents” and “Shared with me”
- Read-only open for a shared user
- Upload of `.txt` and `.md` files into a new document
- A clear error for any other file type, including `.docx`
- Automated tests for health, login, and document create plus list

## Not included

- Real-time collaboration
- Comments
- Version history
- `.docx` import
- User registration or password hashing
- Database migrations for an existing `docs.db`

## Seeded credentials

Password for every account: `password`

- alice@example.com
- bob@example.com
- charlie@example.com

## Run locally

See [README.md](README.md). From `backend/`, install requirements, run `seed.py`, then uvicorn on port 8000. From `frontend/`, run `npm install` and `npm run dev`, then open http://localhost:5173.
