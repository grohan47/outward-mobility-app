"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DemoUser = {
  email: string;
  full_name: string;
  role_code: string;
  role_display_name: string;
};

function roleRoute(role: string): string {
  if (role === "GENERATOR") return "/generator";
  if (role === "ADMIN") return "/admin";
  return "/reviewer";
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);

  useEffect(() => {
    // Frontend -> API: GET /api/auth/demo-users
    fetch("/api/auth/demo-users")
      .then((r) => r.json())
      .then((d) => setDemoUsers(d.items || []))
      .catch(() => setDemoUsers([]));
  }, []);

  const groupedUsers = useMemo(() => {
    const students = demoUsers.filter((u) => u.role_code === "GENERATOR");
    const reviewers = demoUsers.filter((u) => u.role_code !== "GENERATOR");
    return { students, reviewers };
  }, [demoUsers]);

  async function signInWithEmail(targetEmail: string) {
    setLoading(true);
    setError(null);

    try {
      // Frontend -> API: POST /api/auth/login
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail.trim().toLowerCase() }),
      });

      const body = await res.json();
      if (!res.ok) {
        setError(body?.detail || body?.error || "Sign in failed.");
        setLoading(false);
        return;
      }

      const user = body.user;
      const workspaces = user?.availableWorkspaces || [];
      if (workspaces.length > 1) {
        router.push("/select-workspace");
      } else {
        router.push(roleRoute(user.role));
      }
      router.refresh();
    } catch {
      setError("Unable to reach auth service. Ensure FastAPI is running on port 8000.");
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    await signInWithEmail(email);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background-light via-white to-green-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
            <svg fill="none" viewBox="0 0 48 48" className="w-8 h-8 text-primary">
              <path
                clipRule="evenodd"
                d="M47.2426 24L24 47.2426L0.757355 24L24 0.757355L47.2426 24ZM12.2426 21H35.7574L24 9.24264L12.2426 21Z"
                fill="currentColor"
                fillRule="evenodd"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">PRISM</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage approval flows across any department or organization</p>
          <p className="text-xs text-slate-400 mt-2">Accounts with multiple roles will choose a workspace after signing in.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/60 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@plaksha.edu.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <span className="material-symbols-outlined text-red-500 text-lg mt-0.5">error</span>
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  Signing in...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">login</span>
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-6">
          <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Demo Login</p>
          <div className="grid grid-cols-1 gap-2">
            {groupedUsers.students.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Generators (Students in this demo)</h3>
                <div className="flex flex-col gap-2">
                  {groupedUsers.students.map((user) => (
                    <button
                      key={user.email}
                      onClick={() => signInWithEmail(user.email)}
                      className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-primary hover:bg-primary/5 transition-colors flex justify-between items-center group"
                    >
                      <div>
                        <div className="font-medium text-slate-800">{user.full_name}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </div>
                      <span className="material-symbols-outlined text-transparent group-hover:text-primary transition-colors">arrow_forward</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {groupedUsers.reviewers.map((user) => (
              <button
                key={user.email}
                onClick={() => signInWithEmail(user.email)}
                disabled={loading}
                className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-primary/40 hover:bg-primary/5 transition-all text-left group disabled:opacity-50"
              >
                <div className="h-8 w-8 rounded-full bg-slate-100 group-hover:bg-primary/10 flex items-center justify-center text-[11px] font-bold text-slate-500 group-hover:text-primary transition-colors">
                  {user.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{user.full_name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                </div>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {user.role_display_name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
