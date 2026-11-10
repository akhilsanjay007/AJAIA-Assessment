import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Link, useParams } from "react-router-dom";
import { getDocument, updateDocument, type DocumentRecord } from "../api";
import { Toolbar } from "../components/Toolbar";

export function EditorPage() {
  const { id } = useParams();
  const documentId = Number(id);
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [title, setTitle] = useState("Untitled");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    editor.commands.setContent(doc.content || "<p></p>", false);
  }, [editor, doc]);

  async function handleSave() {
    if (!editor || !Number.isInteger(documentId)) {
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
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !editor}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
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
              onChange={(event) => {
                setTitle(event.target.value);
                setStatus(null);
              }}
              className="w-full text-2xl font-semibold text-slate-900 outline-none"
            />
          </label>
          <Toolbar editor={editor} />
          <EditorContent editor={editor} />
        </div>
        {status ? <p className="mt-3 text-sm text-slate-500">{status}</p> : null}
      </section>
    </main>
  );
}
