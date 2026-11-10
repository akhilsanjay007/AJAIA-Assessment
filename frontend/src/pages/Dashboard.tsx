import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  createDocument,
  getStoredUser,
  listDocuments,
  logout,
  uploadDocument,
  type DocumentRecord,
} from "../api";

function formatEdited(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DocumentGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
      <path
        fill="currentColor"
        d="M7 2.75A2.25 2.25 0 0 0 4.75 5v14A2.25 2.25 0 0 0 7 21.25h10A2.25 2.25 0 0 0 19.25 19V8.35c0-.6-.24-1.17-.66-1.59l-3.35-3.35a2.25 2.25 0 0 0-1.59-.66H7Zm6.25 1.56.01.94c0 .97.78 1.75 1.75 1.75h.94l-2.7-2.69ZM6.25 5c0-.41.34-.75.75-.75h5v2c0 1.52 1.23 2.75 2.75 2.75h2v10c0 .41-.34.75-.75.75H7a.75.75 0 0 1-.75-.75V5Z"
      />
      <path fill="currentColor" d="M8 12.25h8v1.5H8v-1.5Zm0 3.25h6v1.5H8v-1.5Z" />
    </svg>
  );
}

const primaryButton =
  "inline-flex h-9 items-center justify-center rounded-md bg-blue-700 px-3.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButton =
  "inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 disabled:cursor-not-allowed disabled:opacity-60";

export function Dashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [owned, setOwned] = useState<DocumentRecord[]>([]);
  const [shared, setShared] = useState<DocumentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listDocuments()
      .then((items) => {
        if (!cancelled) {
          setOwned(items.owned);
          setShared(items.shared);
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

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (extension !== ".txt" && extension !== ".md") {
      setError("Only .txt and .md files can be uploaded");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const created = await uploadDocument(file);
      navigate(`/documents/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload file");
    } finally {
      setUploading(false);
    }
  }

  function DocumentSection({
    title,
    documents,
    empty,
    onOpen,
    showAccess = false,
    actions,
  }: {
    title: string;
    documents: DocumentRecord[];
    empty: string;
    onOpen: (id: number) => void;
    showAccess?: boolean;
    actions?: ReactNode;
  }) {
    return (
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
          {actions}
        </div>
        {documents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400">
              <DocumentGlyph />
            </div>
            <p className="text-sm text-slate-500">{empty}</p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {documents.map((document, index) => (
              <li key={document.id} className={index > 0 ? "border-t border-slate-100" : undefined}>
                <button
                  type="button"
                  onClick={() => onOpen(document.id)}
                  className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-[#f8f9fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/30"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                    <DocumentGlyph />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{document.title}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Last edited {formatEdited(document.updated_at)}
                    </span>
                  </span>
                  {showAccess ? (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {document.can_edit ? "Can edit" : "Can view"}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  return (
    <main className="min-h-screen bg-[#f8f9fa]">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-700 text-xs font-semibold text-white">
              D
            </span>
            <span className="text-sm font-semibold tracking-tight text-slate-900">Document Editor</span>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-600">{user?.name}</p>
            <button type="button" onClick={handleLogout} className={secondaryButton}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        {error ? (
          <p role="alert" className="mb-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <DocumentSection
          title="My documents"
          documents={owned}
          empty="No documents yet. Create one to start writing."
          onOpen={(id) => navigate(`/documents/${id}`)}
          actions={
            <div className="flex items-center gap-2">
              <label
                className={`${secondaryButton} cursor-pointer ${uploading ? "pointer-events-none opacity-60" : ""}`}
              >
                {uploading ? "Uploading..." : "Upload .txt or .md"}
                <input
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  className="sr-only"
                  disabled={uploading}
                  onChange={handleUpload}
                />
              </label>
              <button type="button" onClick={handleCreate} disabled={creating} className={primaryButton}>
                {creating ? "Creating..." : "New document"}
              </button>
            </div>
          }
        />
        <div className="mt-14 border-t border-slate-200/80 pt-10">
          <DocumentSection
            title="Shared with me"
            documents={shared}
            empty="Nothing has been shared with you yet."
            showAccess
            onOpen={(id) => navigate(`/documents/${id}`)}
          />
        </div>
      </div>
    </main>
  );
}
