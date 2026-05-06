"use client";
import { useEffect, useState } from "react";

export type SLANotificationState = {
  approaching: number;
  breached: number;
  items: unknown[];
  loading: boolean;
};

export function useSLANotifications(intervalMs = 60_000): SLANotificationState {
  const [state, setState] = useState<SLANotificationState>({
    approaching: 0,
    breached: 0,
    items: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/admin/sla-notifications", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          setState({ approaching: data.approaching, breached: data.breached, items: data.items ?? [], loading: false });
        }
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      }
    }

    poll();
    const id = setInterval(poll, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [intervalMs]);

  return state;
}
