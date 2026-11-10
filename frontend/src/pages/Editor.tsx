import { FormEvent, useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Link, useParams } from "react-router-dom";
import { getDocument, shareDocument, updateDocument, type DocumentRecord } from "../api";
import { Toolbar } from "../components/Toolbar";

export function EditorPage() {
  const { id } = useParams();
  const documentId = Number(id);
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [title, setTitle] = useState("Untitled");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const canEdit = doc?.can_edit ?? false;

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
    editor.setEditable(doc.can_edit);
    editor.commands.setContent(doc.content || "<p></p>", false);
  }, [editor, doc]);

  async function handleShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isInteger(documentId)) {
      return;
    }
    setError(null);
    setShareMessage(null);
    try {
      const result = await shareDocument(documentId, shareEmail);
      setShareMessage(result.detail);
      setShareEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not share document");
    }
  }

  async function handleSave() {
    if (!editor || !canEdit || !Number.isInteger(documentId)) {
      return;
    }
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await updateDocument(documentId, {
        title,
        content: editor.getHTML(),
      });
      setStatus("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save document");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/documents" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Back to documents
          </Link>
          {canEdit ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !editor}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          ) : (
            <p className="text-sm font-medium text-slate-500">View only</p>
          )}
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
              value={title}
              readOnly={!canEdit}
              onChange={(event) => {
                setTitle(event.target.value);
                setStatus(null);
              }}
              className="w-full text-2xl font-semibold text-slate-900 outline-none read-only:text-slate-700"
            />
          </label>
          {canEdit ? <Toolbar editor={editor} /> : null}
          <EditorContent editor={editor} />
        </div>
        {canEdit ? (
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
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Share
            </button>
            {shareMessage ? <p className="text-sm text-slate-600">{shareMessage}</p> : null}
          </form>
        ) : null}
        {status ? <p className="mt-3 text-sm text-slate-500">{status}</p> : null}
      </section>
    </main>
  );
}
