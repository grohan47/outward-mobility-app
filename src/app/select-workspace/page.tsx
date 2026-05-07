"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type WorkspaceOption = {
  role: string;
  roleDisplayName: string;
  dashboardPath: string;
};

type SessionUser = {
  name: string;
  role: string;
  availableWorkspaces?: WorkspaceOption[];
};

export default function SelectWorkspacePage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingRole, setSubmittingRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Frontend -> API: GET /api/auth/me
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unauthorized");
        }
        return response.json();
      })
      .then((data) => {
        const nextUser = data.user || null;
        const workspaces = nextUser?.availableWorkspaces || [];
        setUser(nextUser);
        setLoading(false);

        if (workspaces.length === 0) {
          setError("No workspaces are available for this account.");
          return;
        }

        if (workspaces.length === 1) {
          router.replace(workspaces[0].dashboardPath);
          router.refresh();
        }
      })
      .catch(() => {
        router.replace("/");
      });
  }, [router]);

  async function selectWorkspace(workspace: WorkspaceOption) {
    setSubmittingRole(workspace.role);
    setError(null);

    try {
      // Frontend -> API: POST /api/auth/select-workspace
      const response = await fetch("/api/auth/select-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: workspace.role }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.detail || "Unable to switch workspace.");
        setSubmittingRole(null);
        return;
      }

      router.push(workspace.dashboardPath);
      router.refresh();
    } catch {
      setError("Unable to reach the auth service right now.");
      setSubmittingRole(null);
    }
  }

  const workspaces = user?.availableWorkspaces || [];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.12),_transparent_40%),linear-gradient(135deg,_#f8fafc_0%,_#ecfeff_45%,_#f8fafc_100%)] px-4 py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-4xl items-center">
        <div className="grid w-full gap-8 rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-2xl shadow-slate-200/70 backdrop-blur md:grid-cols-[0.9fr,1.1fr] md:p-10">
          <section className="flex flex-col justify-between rounded-[1.5rem] bg-slate-950 px-7 py-8 text-white">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-teal-300">Workspace Picker</p>
              <h1 className="mt-4 text-3xl font-black tracking-tight">Choose how you want to work today.</h1>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                One account can belong to multiple approval surfaces. Pick the dashboard that matches what you want to do next.
              </p>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Signed in as</p>
              <p className="mt-2 text-lg font-bold">{user?.name || "Loading..."}</p>
              <p className="mt-1 text-sm text-slate-300">
                {loading ? "Reading your available workspaces..." : `${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"} available`}
              </p>
            </div>
          </section>

          <section className="flex flex-col justify-center">
            <div className="mb-6">
              <p className="text-sm font-bold uppercase tracking-[0.28em] text-slate-400">Available Dashboards</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Select a workspace</h2>
              <p className="mt-2 text-sm text-slate-500">
                You can switch again later from the top bar whenever your account has more than one role.
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-3">
              {workspaces.map((workspace) => {
                const isSubmitting = submittingRole === workspace.role;
                return (
                  <button
                    key={workspace.role}
                    type="button"
                    disabled={loading || isSubmitting}
                    onClick={() => selectWorkspace(workspace)}
                    className="group flex w-full items-center justify-between rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 hover:shadow-lg disabled:opacity-60"
                  >
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">{workspace.role}</p>
                      <p className="mt-1 text-lg font-black text-slate-950">{workspace.roleDisplayName}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {workspace.role === "GENERATOR" && "Browse only the opportunities you were explicitly assigned to and track your applications."}
                        {workspace.role === "REVIEWER" && "Open the reviewer inbox and work through assigned approval steps."}
                        {workspace.role === "ADMIN" && "Configure opportunities, workflows, and platform settings."}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {isSubmitting ? (
                        <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-slate-300 transition-colors group-hover:text-primary">arrow_forward</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
