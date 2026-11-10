import { FormEvent, useState } from "react";
import { getStoredUser, login, logout, type User } from "../api";

export function Login() {
  const [email, setEmail] = useState("alice@example.com");
  const [password, setPassword] = useState("password");
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      setUser(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    logout();
    setUser(null);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Document Editor
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {user ? `Welcome, ${user.name}` : "Sign in"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {user ? user.email : "Use your account to open the editor."}
        </p>

        {user ? (
          <button
            type="button"
            onClick={handleLogout}
            className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Sign out
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-slate-400 focus:ring-2"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-slate-400 focus:ring-2"
              />
            </label>
            {error ? (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
            <p className="text-xs leading-5 text-slate-500">
              Demo accounts: alice@example.com, bob@example.com, charlie@example.com.
              Password for each is password.
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
