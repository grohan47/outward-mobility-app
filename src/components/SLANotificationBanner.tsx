"use client";
import { useEffect, useMemo, useState } from "react";
import { useSLANotifications } from "@/hooks/useSLANotifications";

export default function SLANotificationBanner() {
  const { approaching, breached, loading, items } = useSLANotifications();
  const [dismissedUntil, setDismissedUntil] = useState(0);
  const storageKey = useMemo(() => `prism:sla-banner:${breached > 0 ? "breached" : "approaching"}`, [breached]);

  useEffect(() => {
    const raw = sessionStorage.getItem(storageKey);
    setDismissedUntil(raw ? Number(raw) || 0 : 0);
  }, [storageKey, approaching, breached]);

  if (loading || (approaching === 0 && breached === 0) || dismissedUntil > Date.now()) return null;

  const isBreached = breached > 0;
  const count = isBreached ? breached : approaching;
  const first = Array.isArray(items) ? (items[0] as { application_id?: number; opportunity_title?: string } | undefined) : undefined;

  function dismiss() {
    const until = Date.now() + 5 * 60 * 1000;
    sessionStorage.setItem(storageKey, String(until));
    setDismissedUntil(until);
  }

  return (
    <div
      className={`fixed inset-x-0 top-16 z-40 flex min-h-[44px] items-center justify-center gap-3 px-4 py-2 text-sm font-bold shadow-sm ${
        isBreached ? "bg-red-600 text-white" : "bg-amber-400 text-amber-950"
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{isBreached ? "warning" : "schedule"}</span>
      <a
        href={first?.application_id ? `/admin/applications/${first.application_id}` : "/admin/applications"}
        className="min-w-0 truncate underline-offset-2 hover:underline"
      >
        {isBreached ? `${count} review${count === 1 ? "" : "s"} overdue` : `${count} review${count === 1 ? "" : "s"} due soon`}
        {first?.opportunity_title ? ` - ${first.opportunity_title}` : ""} - click to view
      </a>
      <button
        type="button"
        onClick={dismiss}
        className={`ml-2 rounded-full p-1 ${isBreached ? "hover:bg-white/15" : "hover:bg-amber-500/30"}`}
        aria-label="Dismiss SLA notification"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}
