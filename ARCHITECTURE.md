# Architecture

## What shipped

The app is a single FastAPI process and a Vite React client. SQLite holds users, documents, share rows, save snapshots, and presence rows. The client talks to the API through a Vite proxy that strips `/api`.

Authentication is the Phase 0 JWT login. Three users are seeded. There is no registration and no password hashing.

A document is a title plus an HTML string. TipTap reads that HTML when a document opens and writes `editor.getHTML()` on save. Bold, italic, underline, headings, and lists are therefore ordinary HTML tags, not a separate JSON document model. Export walks that same HTML in the browser and downloads Markdown. It does not round-trip through the server.

Each save writes a `document_versions` row with the title, HTML, user, and time, then keeps the newest 10. Restore copies one of those rows back through the same save path, so the restored text becomes the latest snapshot. Opening an older version in the editor is read-only until restore.

Sharing is a join table, `document_shares`, with one row per document and recipient and a `permission` of `view` or `edit`. Only the owner can create or change a row. A viewer can open the document and sees `can_edit: false`. An editor can save. Neither can share it further. Two people with edit access still use last-write-wins. There is no merge.

Presence is a `document_presence` row updated while the editor is open. The client heartbeats every 8 seconds and deletes the row on leave. The document page lists other people whose `last_seen` is within 20 seconds. That is a viewing indicator, not a shared cursor and not a conflict-free merge.

Uploads accept `.txt` and `.md` only. The text is escaped and wrapped in paragraphs so TipTap can load it. Markdown syntax stays visible as text. There is no Markdown renderer on upload and no `.docx` parser.

SQLite uses `Base.metadata.create_all` when the API starts. New tables appear on an empty database. An existing `docs.db` is not altered in place, so a new column such as `permission` means deleting the file and running `seed.py` again. Alembic was skipped because this demo has no production data to migrate.

## Why these choices

HTML storage is the smallest way to keep formatting across a refresh. The editor and the database agree on one string. A custom block JSON format would need its own serializer and would not make sharing or upload simpler. Markdown export is a one-way client conversion of that HTML. Underline has no Markdown syntax, so it is written as `<u>`.

Snapshots are whole documents, not diffs. Ten rows are enough to undo a recent save without a history browser. Restore goes through the normal save so the current text is not lost from the list.

View and edit are one column on the existing share row. The editor already treated `can_edit` as the switch between a writable TipTap instance and a read-only one, so editors and viewers use the same page.

Presence polling avoids a WebSocket and any operational transform. A person can be listed for a few seconds after they leave if the delete request does not land. The list can also lag by one 8-second poll.

## What was left out

Comments, conflict-free collaborative editing, and `.docx` import are out of scope. Two editors can overwrite each other. Presence only answers who has the document open.

## Branch order

The work is stacked:

1. `feature/rich-text` — documents and TipTap
2. `feature/sharing` — share table, owner-only share, split dashboard
3. `feature/upload` — create a document from a text file
4. `feature/polish` — the create-and-list test and these docs

Later branches were rebased onto the previous phase before implementation because they all change the document API, the dashboard, and the editor.
