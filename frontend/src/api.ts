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

export async function login(email: string, password: string): Promise<LoginResponse> {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);

  const response = await fetch("/api/auth/login", {
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
