# Submission

## Included

- FastAPI backend, SQLite, and seeded JWT login
- React, Vite, TypeScript, Tailwind, and TipTap
- Document create, rename, edit, save, and list
- Rich text: bold, italic, underline, H1–H3, bullet list, and numbered list
- HTML content persisted and reloaded
- Sharing with view and edit permissions (owner only)
- Dashboard sections for “My documents” and “Shared with me”
- Read-only mode for viewers
- Upload of `.txt` and `.md` files to create a document
- Version history: the last 10 snapshots, with view and restore
- Presence indicators for who has the document open
- Export to Markdown
- Automated tests for health, auth, and documents

## Not included

- Full real-time collaborative editing (no CRDT or operational transform)
- Comments
- `.docx` import
- User registration or password hashing
- Database migrations for an existing `docs.db`

## Seeded credentials

Password for all accounts: `password`

- alice@example.com
- bob@example.com
- charlie@example.com

## Run locally

Setup steps are in [README.md](README.md).

## Notes

- Presence is polling-based, not a WebSocket
- Two editors can still overwrite each other (last-write-wins)
- Version history keeps the last 10 saves
