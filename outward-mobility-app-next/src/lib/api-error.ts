export function parseApiError(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const b = body as Record<string, unknown>;
  const detail = b.detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((item: unknown) => {
        if (!item || typeof item !== "object") return String(item);
        const d = item as Record<string, unknown>;
        const loc = Array.isArray(d.loc) ? d.loc.join(" → ") : null;
        const msg = typeof d.msg === "string" ? d.msg : null;
        return loc && msg ? `${loc}: ${msg}` : msg || loc || String(item);
      })
      .filter(Boolean);
    return msgs.length > 0 ? msgs.join("; ") : fallback;
  }
  if (typeof detail === "string") return detail || fallback;
  if (typeof b.error === "string") return b.error || fallback;
  if (typeof b.message === "string") return b.message || fallback;
  return fallback;
}
