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

const EDITOR_CLASS =
  "editor-content min-h-[680px] px-8 pb-24 pt-6 focus:outline-none sm:px-16";

const primaryButton =
  "inline-flex h-9 items-center justify-center rounded-md bg-blue-700 px-3.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButton =
  "inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 disabled:cursor-not-allowed disabled:opacity-60";

const fieldClass =
  "mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";

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
  const [shareOpen, setShareOpen] = useState(false);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [preview, setPreview] = useState<DocumentVersion | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [viewers, setViewers] = useState<PresenceUser[]>([]);
  const canEdit = doc?.can_edit ?? false;
  const editing = canEdit && preview === null;
  const isOwner = doc !== null && currentUser !== null && doc.owner_id === currentUser.id;
  const panelOpen = historyOpen || (isOwner && shareOpen);

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
        class: EDITOR_CLASS,
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
    <main className="min-h-screen bg-[#f8f9fa]">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-5">
          <div className="min-w-0">
            <Link
              to="/documents"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              ← Back to documents
            </Link>
            {viewers.length > 0 ? (
              <p className="mt-0.5 truncate text-xs text-slate-500">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />
                Also viewing: {viewers.map((person) => person.name).join(", ")}
              </p>
            ) : null}
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {status ? <span className="text-xs text-slate-400">{status}</span> : null}
            {isOwner ? (
              <button
                type="button"
                aria-expanded={shareOpen}
                onClick={() => setShareOpen((open) => !open)}
                className={shareOpen ? `${secondaryButton} bg-slate-100` : secondaryButton}
              >
                Share
              </button>
            ) : null}
            <button
              type="button"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen((open) => !open)}
              className={historyOpen ? `${secondaryButton} bg-slate-100` : secondaryButton}
            >
              History
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={!editor && !doc}
              className={secondaryButton}
            >
              Export
            </button>
            {editing ? (
              <button type="button" onClick={handleSave} disabled={saving || !editor} className={primaryButton}>
                {saving ? "Saving..." : "Save"}
              </button>
            ) : (
              <span className="inline-flex h-9 items-center rounded-md bg-slate-100 px-3 text-sm font-medium text-slate-600">
                {preview ? "Viewing history" : "View only"}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row lg:items-start">
        <div className="min-w-0 w-full lg:flex-1">
          <div className="mx-auto w-full max-w-[840px] px-4 py-8 sm:px-6 sm:py-10">
            {error ? (
              <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <article className="min-h-[calc(100vh-8rem)] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.12),0_2px_8px_rgba(60,64,67,0.08)] ring-1 ring-slate-900/[0.04]">
              <label className="block px-8 pt-10 sm:px-16 sm:pt-12">
                <span className="sr-only">Title</span>
                <input
                  value={preview ? preview.title : title}
                  readOnly={!editing}
                  placeholder="Untitled"
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setStatus(null);
                  }}
                  className="w-full border-0 bg-transparent text-[1.75rem] font-normal leading-tight tracking-tight text-slate-900 outline-none placeholder:text-slate-300 read-only:cursor-default sm:text-[2rem]"
                />
              </label>
              {editing ? <Toolbar editor={editor} /> : <div className="mt-6 border-b border-slate-200" />}
              <EditorContent editor={editor} />
            </article>
          </div>
        </div>

        {panelOpen ? (
          <aside className="w-full border-t border-slate-200 bg-white lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:w-[320px] lg:shrink-0 lg:self-start lg:overflow-y-auto lg:border-l lg:border-t-0">
            {isOwner && shareOpen ? (
              <section className="border-b border-slate-100 px-5 py-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-900">Share</h2>
                  <button
                    type="button"
                    onClick={() => setShareOpen(false)}
                    className="text-sm font-medium text-slate-500 hover:text-slate-800"
                  >
                    Close
                  </button>
                </div>
                <form onSubmit={handleShare} className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Share with
                    <input
                      type="email"
                      required
                      value={shareEmail}
                      onChange={(event) => setShareEmail(event.target.value)}
                      placeholder="bob@example.com"
                      className={fieldClass}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Permission
                    <select
                      value={sharePermission}
                      onChange={(event) => setSharePermission(event.target.value as SharePermission)}
                      className={fieldClass}
                    >
                      <option value="view">Can view</option>
                      <option value="edit">Can edit</option>
                    </select>
                  </label>
                  <button type="submit" className={`${primaryButton} w-full`}>
                    Share
                  </button>
                  {shareMessage ? <p className="text-sm text-slate-600">{shareMessage}</p> : null}
                </form>
                {shares.length > 0 ? (
                  <ul className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
                    {shares.map((share) => (
                      <li key={share.email} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-800">{share.name}</span>
                          <span className="block truncate text-xs text-slate-500">{share.email}</span>
                        </span>
                        <span className="shrink-0 text-xs text-slate-500">
                          {share.permission === "edit" ? "Can edit" : "Can view"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            {historyOpen ? (
              <section className="px-5 py-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-900">History</h2>
                  <div className="flex items-center gap-3">
                    {preview ? (
                      <button
                        type="button"
                        onClick={() => setPreview(null)}
                        className="text-sm font-medium text-slate-700 hover:text-slate-900"
                      >
                        Back to current
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setHistoryOpen(false)}
                      className="text-sm font-medium text-slate-500 hover:text-slate-800"
                    >
                      Close
                    </button>
                  </div>
                </div>
                {versions.length === 0 ? (
                  <p className="text-sm text-slate-500">No saved versions yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {versions.map((version) => {
                      const selected = preview?.id === version.id;
                      return (
                        <li key={version.id} className="py-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setPreview(version)}
                              className={`min-w-0 flex-1 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-slate-50 ${
                                selected ? "bg-blue-50" : ""
                              }`}
                            >
                              <span className="block truncate text-sm font-medium text-slate-900">
                                {version.title}
                              </span>
                              <span className="mt-0.5 block text-xs text-slate-500">
                                {version.saved_by_name} · {new Date(version.created_at).toLocaleString()}
                              </span>
                            </button>
                            {selected && canEdit ? (
                              <button
                                type="button"
                                onClick={() => handleRestore(version)}
                                disabled={restoring}
                                className={`${secondaryButton} mt-1 shrink-0`}
                              >
                                {restoring ? "Restoring..." : "Restore"}
                              </button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ) : null}
          </aside>
        ) : null}
      </div>
    </main>
  );
}
