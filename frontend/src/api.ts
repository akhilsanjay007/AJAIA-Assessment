export type User = {
  id: number;
  email: string;
  name: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

const TOKEN_KEY = "access_token";
const USER_KEY = "user";

// Local `npm run dev` leaves this unset and uses the Vite `/api` proxy.
// A production build uses VITE_API_URL (see frontend/.env.production).
function resolveApiUrl(path: string): string {
  const configured = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "");
  if (!configured) {
    return path;
  }
  const suffix = path.startsWith("/api/") || path === "/api" ? path.slice(4) : path;
  return `${configured}${suffix}`;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export type DocumentRecord = {
  id: number;
  title: string;
  content: string;
  owner_id: number;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
};

export type DocumentList = {
  owned: DocumentRecord[];
  shared: DocumentRecord[];
};

export type DocumentInput = {
  title: string;
  content: string;
};

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(resolveApiUrl(path), { ...init, headers });
  if (response.status === 401) {
    logout();
    throw new Error("Please sign in again");
  }
  if (!response.ok) {
    let message = "Request failed";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (typeof payload.detail === "string") {
        message = payload.detail;
      }
    } catch {
      // Keep the fallback message when the body is not JSON.
    }
    throw new Error(message);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function listDocuments(): Promise<DocumentList> {
  return api<DocumentList>("/api/documents");
}

export async function uploadDocument(file: File): Promise<DocumentRecord> {
  const body = new FormData();
  body.append("file", file);
  const headers = new Headers();
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(resolveApiUrl("/api/documents/upload"), { method: "POST", body, headers });
  if (response.status === 401) {
    logout();
    throw new Error("Please sign in again");
  }
  if (!response.ok) {
    let message = "Upload failed";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (typeof payload.detail === "string") {
        message = payload.detail;
      }
    } catch {
      // Keep the fallback message when the body is not JSON.
    }
    throw new Error(message);
  }
  return (await response.json()) as DocumentRecord;
}

export type SharePermission = "view" | "edit";

export type ShareGrant = {
  email: string;
  name: string;
  permission: SharePermission;
};

export function shareDocument(
  id: number,
  email: string,
  permission: SharePermission = "view",
): Promise<{ detail: string }> {
  return api<{ detail: string }>(`/api/documents/${id}/share`, {
    method: "POST",
    body: JSON.stringify({ email, permission }),
  });
}

export function listShares(id: number): Promise<ShareGrant[]> {
  return api<ShareGrant[]>(`/api/documents/${id}/shares`);
}

export function createDocument(input: DocumentInput): Promise<DocumentRecord> {
  return api<DocumentRecord>("/api/documents", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getDocument(id: number): Promise<DocumentRecord> {
  return api<DocumentRecord>(`/api/documents/${id}`);
}

export function updateDocument(id: number, input: DocumentInput): Promise<DocumentRecord> {
  return api<DocumentRecord>(`/api/documents/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export type DocumentVersion = {
  id: number;
  title: string;
  content: string;
  saved_by_user_id: number;
  saved_by_name: string;
  created_at: string;
};

export function listVersions(id: number): Promise<DocumentVersion[]> {
  return api<DocumentVersion[]>(`/api/documents/${id}/versions`);
}

export function restoreVersion(id: number, versionId: number): Promise<DocumentRecord> {
  return api<DocumentRecord>(`/api/documents/${id}/versions/${versionId}/restore`, {
    method: "POST",
  });
}

export type PresenceUser = {
  id: number;
  name: string;
  email: string;
};

export function heartbeatPresence(id: number): Promise<void> {
  return api<void>(`/api/documents/${id}/presence`, { method: "POST" });
}

export function listPresence(id: number): Promise<PresenceUser[]> {
  return api<PresenceUser[]>(`/api/documents/${id}/presence`);
}

export function leavePresence(id: number): void {
  const headers = new Headers();
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  void fetch(resolveApiUrl(`/api/documents/${id}/presence`), { method: "DELETE", headers, keepalive: true });
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);

  const response = await fetch(resolveApiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    let message = "Login failed";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (typeof payload.detail === "string") {
        message = payload.detail;
      }
    } catch {
      // Keep the fallback message when the body is not JSON.
    }
    throw new Error(message);
  }

  const data = (await response.json()) as LoginResponse;
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}
