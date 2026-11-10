import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getToken, login } from "../api";

const fieldClass =
  "mt-1.5 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("alice@example.com");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (getToken()) {
    return <Navigate to="/documents" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/documents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-4 py-12">
      <section className="w-full max-w-[400px] rounded-xl border border-slate-200 bg-white px-8 py-10 shadow-[0_1px_2px_rgba(60,64,67,0.06),0_8px_24px_rgba(60,64,67,0.05)]">
        <div className="mb-8">
          <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-sm font-semibold text-white">
            D
          </div>
          <h1 className="text-[1.65rem] font-semibold tracking-tight text-slate-900">Sign in</h1>
          <p className="mt-1.5 text-sm leading-6 text-slate-500">Use your account to open the editor.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={fieldClass}
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
              className={fieldClass}
            />
          </label>
          {error ? (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 h-10 w-full rounded-md bg-blue-700 text-sm font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
          <p className="rounded-md bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-500">
            Demo accounts: alice@example.com, bob@example.com, charlie@example.com. Password for each is
            password.
          </p>
        </form>
      </section>
    </main>
  );
}
