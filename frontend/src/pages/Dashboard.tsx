import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createDocument,
  getStoredUser,
  listDocuments,
  logout,
  type DocumentRecord,
} from "../api";

export function Dashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listDocuments()
      .then((items) => {
        if (!cancelled) {
          setDocuments(items);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load documents");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const created = await createDocument({ title: "Untitled", content: "<p></p>" });
      navigate(`/documents/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create document");
      setCreating(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Document Editor
            </p>
            <h1 className="text-xl font-semibold text-slate-900">My documents</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-600">{user?.name}</p>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {creating ? "Creating..." : "New document"}
          </button>
        </div>
        {error ? (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {error}
          </p>
        ) : null}
        {documents.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
            No documents yet. Create one to start writing.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {documents.map((document) => (
              <li key={document.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/documents/${document.id}`)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-900">{document.title}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(document.updated_at).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
