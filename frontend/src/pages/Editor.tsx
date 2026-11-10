import { FormEvent, useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Link, useParams } from "react-router-dom";
import {
  heartbeatPresence,
  getDocument,
  getStoredUser,
  leavePresence,
  listPresence,
  listShares,
  listVersions,
  restoreVersion,
  shareDocument,
  updateDocument,
  type DocumentRecord,
  type DocumentVersion,
  type PresenceUser,
  type ShareGrant,
  type SharePermission,
} from "../api";
import { Toolbar } from "../components/Toolbar";
import { downloadMarkdown } from "../htmlToMarkdown";

export function EditorPage() {
  const { id } = useParams();
  const documentId = Number(id);
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [title, setTitle] = useState("Untitled");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState<SharePermission>("view");
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shares, setShares] = useState<ShareGrant[]>([]);
  const currentUser = getStoredUser();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [preview, setPreview] = useState<DocumentVersion | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [viewers, setViewers] = useState<PresenceUser[]>([]);
  const canEdit = doc?.can_edit ?? false;
  const editing = canEdit && preview === null;
  const isOwner = doc !== null && currentUser !== null && doc.owner_id === currentUser.id;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
    ],
    content: "<p></p>",
    editorProps: {
      attributes: {
        class: "editor-content min-h-[420px] px-5 py-4 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (!Number.isInteger(documentId)) {
      setError("Document not found");
      return;
    }
    let cancelled = false;
    getDocument(documentId)
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        setDoc(loaded);
        setTitle(loaded.title);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load document");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    if (!editor || !doc) {
      return;
    }
    if (preview) {
      editor.setEditable(false);
      editor.commands.setContent(preview.content || "<p></p>", false);
      return;
    }
    editor.setEditable(doc.can_edit);
    editor.commands.setContent(doc.content || "<p></p>", false);
  }, [editor, doc, preview]);

  useEffect(() => {
    if (!historyOpen || !Number.isInteger(documentId)) {
      return;
    }
    let cancelled = false;
    listVersions(documentId)
      .then((items) => {
        if (!cancelled) {
          setVersions(items);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load history");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [historyOpen, documentId]);

  useEffect(() => {
    if (!isOwner || !Number.isInteger(documentId)) {
      setShares([]);
      return;
    }
    let cancelled = false;
    listShares(documentId)
      .then((items) => {
        if (!cancelled) {
          setShares(items);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load shares");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOwner, documentId]);

  useEffect(() => {
    if (!Number.isInteger(documentId)) {
      return;
    }
    let cancelled = false;

    async function tick() {
      try {
        await heartbeatPresence(documentId);
        const people = await listPresence(documentId);
        if (!cancelled) {
          setViewers(people.filter((person) => person.id !== currentUser?.id));
        }
      } catch {
        if (!cancelled) {
          setViewers([]);
        }
      }
    }

    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      leavePresence(documentId);
    };
  }, [documentId, currentUser?.id]);

  async function handleShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isInteger(documentId)) {
      return;
    }
    setError(null);
    setShareMessage(null);
    try {
      const result = await shareDocument(documentId, shareEmail, sharePermission);
      setShareMessage(result.detail);
      setShareEmail("");
      setShares(await listShares(documentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not share document");
    }
  }

  function handleExport() {
    const html = editor?.getHTML() || preview?.content || doc?.content || "<p></p>";
    downloadMarkdown(preview?.title ?? title, html);
  }

  async function handleSave() {
    if (!editor || !editing || !Number.isInteger(documentId)) {
      return;
    }
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const saved = await updateDocument(documentId, {
        title,
        content: editor.getHTML(),
      });
      setDoc(saved);
      setTitle(saved.title);
      setStatus("Saved");
      if (historyOpen) {
        setVersions(await listVersions(documentId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save document");
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore(version: DocumentVersion) {
    if (!canEdit || !Number.isInteger(documentId)) {
      return;
    }
    setRestoring(true);
    setError(null);
    setStatus(null);
    try {
      const restored = await restoreVersion(documentId, version.id);
      setPreview(null);
      setDoc(restored);
      setTitle(restored.title);
      setVersions(await listVersions(documentId));
      setStatus("Restored");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore version");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <Link to="/documents" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Back to documents
            </Link>
            {viewers.length > 0 ? (
              <p className="mt-1 text-xs text-slate-500">
                Also viewing: {viewers.map((person) => person.name).join(", ")}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              History
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={!editor && !doc}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              Export
            </button>
            {editing ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !editor}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            ) : (
              <p className="text-sm font-medium text-slate-500">
                {preview ? "Viewing history" : "View only"}
              </p>
            )}
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-3xl px-4 py-8">
        {error ? (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <label className="block border-b border-slate-200 px-5 py-4">
            <span className="sr-only">Title</span>
            <input
              value={preview ? preview.title : title}
              readOnly={!editing}
              onChange={(event) => {
                setTitle(event.target.value);
                setStatus(null);
              }}
              className="w-full text-2xl font-semibold text-slate-900 outline-none read-only:text-slate-700"
            />
          </label>
          {editing ? <Toolbar editor={editor} /> : null}
          <EditorContent editor={editor} />
        </div>
        {isOwner ? (
          <form onSubmit={handleShare} className="mt-4 flex flex-wrap items-end gap-2">
            <label className="text-sm font-medium text-slate-700">
              Share with
              <input
                type="email"
                required
                value={shareEmail}
                onChange={(event) => setShareEmail(event.target.value)}
                placeholder="bob@example.com"
                className="mt-1 block w-64 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-slate-400 focus:ring-2"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Permission
              <select
                value={sharePermission}
                onChange={(event) => setSharePermission(event.target.value as SharePermission)}
                className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-slate-400 focus:ring-2"
              >
                <option value="view">Can view</option>
                <option value="edit">Can edit</option>
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Share
            </button>
            {shareMessage ? <p className="text-sm text-slate-600">{shareMessage}</p> : null}
          </form>
        ) : null}
        {isOwner && shares.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {shares.map((share) => (
              <li key={share.email}>
                {share.name} ({share.email}) · {share.permission === "edit" ? "Can edit" : "Can view"}
              </li>
            ))}
          </ul>
        ) : null}
        {historyOpen ? (
          <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">History</h2>
              {preview ? (
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="text-sm font-medium text-slate-700 hover:text-slate-900"
                >
                  Back to current
                </button>
              ) : null}
            </div>
            {versions.length === 0 ? (
              <p className="text-sm text-slate-500">No saved versions yet.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {versions.map((version) => (
                  <li key={version.id} className="flex items-center justify-between gap-3 py-2">
                    <button
                      type="button"
                      onClick={() => setPreview(version)}
                      className="text-left text-sm text-slate-800 hover:text-slate-950"
                    >
                      <span className="font-medium">{version.title}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {version.saved_by_name} · {new Date(version.created_at).toLocaleString()}
                      </span>
                    </button>
                    {preview?.id === version.id && canEdit ? (
                      <button
                        type="button"
                        onClick={() => handleRestore(version)}
                        disabled={restoring}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {restoring ? "Restoring..." : "Restore"}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
        {status ? <p className="mt-3 text-sm text-slate-500">{status}</p> : null}
      </section>
    </main>
  );
}
