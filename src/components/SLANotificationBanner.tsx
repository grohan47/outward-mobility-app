"use client";
import { useSLANotifications } from "@/hooks/useSLANotifications";

export default function SLANotificationBanner() {
  const { approaching, breached, loading } = useSLANotifications();

  if (loading || (approaching === 0 && breached === 0)) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium">
      {breached > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-red-800 border border-red-200">
          <span className="material-symbols-outlined text-[15px]">warning</span>
          {breached} SLA breached
        </span>
      )}
      {approaching > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-amber-800 border border-amber-200">
          <span className="material-symbols-outlined text-[15px]">schedule</span>
          {approaching} due soon
        </span>
      )}
    </div>
  );
}
