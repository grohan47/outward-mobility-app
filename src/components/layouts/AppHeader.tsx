"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface AppHeaderProps {
  userName: string;
  roleDisplayName: string;
  canSwitchWorkspace?: boolean;
}

export function AppHeader({ userName, roleDisplayName, canSwitchWorkspace = false }: AppHeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    // Frontend -> API: POST /api/auth/logout
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="fixed top-0 inset-x-0 h-16 bg-white border-b border-slate-200 z-50 flex items-center justify-between px-6">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <svg fill="none" viewBox="0 0 48 48" className="w-4 h-4 text-primary">
              <path
                clipRule="evenodd"
                d="M47.2426 24L24 47.2426L0.757355 24L24 0.757355L47.2426 24ZM12.2426 21H35.7574L24 9.24264L12.2426 21Z"
                fill="currentColor"
                fillRule="evenodd"
              />
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900 group-hover:text-primary transition-colors">
            PRISM
          </span>
        </Link>
        
        {/* Simple Breadcrumb/Context */}
        <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
          <span className="mx-2 text-slate-300">/</span>
          <span className="font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
            {roleDisplayName} Workspace
          </span>
        </div>
      </div>

      <div className="flex items-center gap-5">
        {canSwitchWorkspace && (
          <Link
            href="/select-workspace"
            className="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
            Switch Workspace
          </Link>
        )}
        <div className="flex flex-col items-end hidden sm:flex">
          <span className="text-sm font-bold text-slate-900 leading-tight">
            {userName}
          </span>
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            {roleDisplayName}
          </span>
        </div>
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-white">
          {userName.split(" ").map((n) => n[0]).join("")}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Sign out"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </div>
    </header>
  );
}
