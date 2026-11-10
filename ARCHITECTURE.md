# Architecture

## What shipped

The app is a single FastAPI process and a Vite React client. SQLite holds users, documents, and share rows. The client talks to the API through a Vite proxy that strips `/api`.

Authentication is the Phase 0 JWT login. Three users are seeded. There is no registration and no password hashing.

A document is a title plus an HTML string. TipTap reads that HTML when a document opens and writes `editor.getHTML()` on save. Bold, italic, underline, headings, and lists are therefore ordinary HTML tags, not a separate JSON document model.

## Why these choices

HTML storage is the smallest way to keep formatting across a refresh. The editor and the database agree on one string. A custom block JSON format would need its own serializer and would not make sharing or upload simpler.

Sharing is a join table, `document_shares`, with one row per document and recipient. Only the owner can create a row. A recipient can open the document and sees `can_edit: false`. They cannot update it and cannot share it further. That matches “open” without turning the app into a collaboration product. Last-write-wins editing was avoided on purpose.

Uploads accept `.txt` and `.md` only. The text is escaped and wrapped in paragraphs so TipTap can load it. Markdown syntax stays visible as text. There is no Markdown renderer and no `.docx` parser.

SQLite uses `Base.metadata.create_all` when the API starts. New tables appear on an empty database. An existing `docs.db` is not altered in place, so schema changes mean deleting the file and running `seed.py` again. Alembic was skipped because this demo has no production data to migrate.

## What was left out

Real-time collaboration, comments, version history, and `.docx` import are out of scope. They need presence, a comment model, snapshots, or a Word parser, and none of those change the core editor.

## Branch order

The work is stacked:

1. `feature/rich-text` — documents and TipTap
2. `feature/sharing` — share table, owner-only share, split dashboard
3. `feature/upload` — create a document from a text file
4. `feature/polish` — the create-and-list test and these docs

Later branches were rebased onto the previous phase before implementation because they all change the document API, the dashboard, and the editor.
