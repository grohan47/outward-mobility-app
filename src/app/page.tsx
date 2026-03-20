"use client";

import { useState } from "react";
import { loginAction } from "./actions";

const DEMO_ACCOUNTS = [
  { email: "student1@plaksha.edu.in", name: "Aditya Sharma", role: "Student" },
  { email: "student2@plaksha.edu.in", name: "Priya Kapoor", role: "Student" },
  { email: "uge-academics@plaksha.edu.in", name: "Dr. Vikram Sahay", role: "UG Academics" },
  { email: "student-life@plaksha.edu.in", name: "Ananya Iyer", role: "Student Life" },
  { email: "program-chair@plaksha.edu.in", name: "Prof. Rajesh Gupta", role: "Program Chair" },
  { email: "oge@plaksha.edu.in", name: "Rajesh Kumar", role: "OGE Admin" },
  { email: "dean@plaksha.edu.in", name: "Dr. Sarah Jenkins", role: "Dean Academics" },
];

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await loginAction(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  async function handleDemoLogin(demoEmail: string) {
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.set("email", demoEmail);
    const result = await loginAction(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background-light via-white to-green-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
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
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            PRISM
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Plaksha Review Interface for Student Mobility
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/60 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-slate-700 mb-1.5"
              >
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
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                defaultValue="demo123"
                className="w-full h-11 rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
              <p className="text-[11px] text-slate-400 mt-1 italic">
                Password is ignored for demo — any value works.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <span className="material-symbols-outlined text-red-500 text-lg mt-0.5">
                  error
                </span>
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
                  <span className="material-symbols-outlined animate-spin text-lg">
                    progress_activity
                  </span>
                  Signing in...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">
                    login
                  </span>
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        {/* Demo Accounts */}
        <div className="mt-6">
          <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Quick Demo Login
          </p>
          <div className="grid grid-cols-1 gap-2">
            {/* Student Area */}
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Applicants (Students)</h3>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleDemoLogin("rohan@plaksha.edu.in")}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-primary hover:bg-primary/5 transition-colors flex justify-between items-center group"
                >
                  <div>
                    <div className="font-medium text-slate-800">Rohan</div>
                    <div className="text-xs text-slate-500">rohan@plaksha.edu.in</div>
                  </div>
                  <span className="material-symbols-outlined text-transparent group-hover:text-primary transition-colors">arrow_forward</span>
                </button>
                <button
                  onClick={() => handleDemoLogin("siddharth@plaksha.edu.in")}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-primary hover:bg-primary/5 transition-colors flex justify-between items-center group"
                >
                  <div>
                    <div className="font-medium text-slate-800">Siddharth</div>
                    <div className="text-xs text-slate-500">siddharth@plaksha.edu.in</div>
                  </div>
                  <span className="material-symbols-outlined text-transparent group-hover:text-primary transition-colors">arrow_forward</span>
                </button>
              </div>
            </div>
            {DEMO_ACCOUNTS.filter(account => account.role !== "Student").map((account) => (
              <button
                key={account.email}
                onClick={() => handleDemoLogin(account.email)}
                disabled={loading}
                className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-primary/40 hover:bg-primary/5 transition-all text-left group disabled:opacity-50"
              >
                <div className="h-8 w-8 rounded-full bg-slate-100 group-hover:bg-primary/10 flex items-center justify-center text-[11px] font-bold text-slate-500 group-hover:text-primary transition-colors">
                  {account.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {account.name}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {account.email}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {account.role}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
