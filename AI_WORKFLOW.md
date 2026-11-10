# AI workflow

Cursor’s agent was used for the whole project, with the phase list as the source of requirements.

Phase 0 was scaffolded from a written spec: FastAPI, SQLite, seeded users, JWT login, a Vite login page, and health and login tests. That commit is the base of `main`.

The remaining work started as a written plan before code. The plan recorded that there was no document model yet, so the rich-text branch had to add documents and TipTap together. It also fixed the branch order: sharing, upload, and polish should be rebased onto the previous phase instead of developed from the empty Phase 0 commit, because they all edit the same document routes and dashboard.

Implementation followed that order.

- `feature/rich-text` added the document API and the TipTap toolbar. Formatting was checked by saving HTML, loading it again, and opening the editor in the browser after a refresh.
- `feature/sharing` added the share table, the owner-only share endpoint, the split dashboard, and a read-only editor for recipients. The share rules were checked with a script against the API: share, repeat share, self-share, unknown email, and a non-owner update.
- `feature/upload` added multipart upload for `.txt` and `.md`, escaped the text into HTML paragraphs, and showed the API error for other types. A `.docx` upload was checked and returned 400.
- `feature/polish` added the create-and-list pytest and the README, architecture, workflow, and submission notes.

pytest was run after the backend changes. The frontend was typechecked with `tsc --noEmit`. The agent wrote the code, the tests, and these documents. Decisions that were already in the plan, such as view-only sharing and HTML storage, were kept rather than redesigned during implementation.
