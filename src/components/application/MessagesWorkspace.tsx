"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  labelForVisibility,
  STAFF_AUDIENCES,
  STUDENT_AUDIENCES,
  type CommentVisibility,
} from "@/components/application/chatStakeholders";
import { Badge } from "@/components/ui/Badge";
import type { ApplicationListItem, Comment } from "@/lib/types";

type RoleVariant = "reviewer" | "admin" | "student";

type SessionPayload = {
  user?: { email?: string };
};

type ReviewerInboxItem = {
  id: number;
  student_name?: string;
  student_id?: string;
  opportunity_title?: string;
  current_stage?: string;
  updated_at?: string;
};

type ConversationItem = {
  id: number;
  title: string;
  subtitle: string;
  context: string;
  status: string;
  updatedAt: string;
  href: string;
};

const WORKSPACE_CONFIG: Record<
  RoleVariant,
  {
    title: string;
    subtitle: string;
    listEndpoint: string;
    emptyTitle: string;
    emptyBody: string;
    openLabel: string;
  }
> = {
  reviewer: {
    title: "Messages",
    subtitle: "Application conversations for work assigned to you.",
    listEndpoint: "/api/reviewer/inbox",
    emptyTitle: "No active conversations",
    emptyBody: "Applications assigned to you will appear here when there is work to review.",
    openLabel: "Open review",
  },
  admin: {
    title: "Messages",
    subtitle: "Conversations across all application threads.",
    listEndpoint: "/api/admin/applications",
    emptyTitle: "No application threads yet",
    emptyBody: "Application conversations will appear here after students submit.",
    openLabel: "Open application",
  },
  student: {
    title: "Messages",
    subtitle: "Comments connected to your submitted applications.",
    listEndpoint: "/api/my/applications",
    emptyTitle: "No application threads yet",
    emptyBody: "Submit an application to start an application thread.",
    openLabel: "Open application",
  },
};

function normalizeConversation(
  role: RoleVariant,
  item: ApplicationListItem | ReviewerInboxItem,
): ConversationItem {
  if (role === "reviewer") {
    const inboxItem = item as ReviewerInboxItem;
    return {
      id: inboxItem.id,
      title: inboxItem.student_name || `Application #${inboxItem.id}`,
      subtitle: inboxItem.opportunity_title || "Opportunity",
      context: inboxItem.student_id || "Assigned review",
      status: inboxItem.current_stage || "In review",
      updatedAt: inboxItem.updated_at || "",
      href: `/reviewer/applications/${inboxItem.id}`,
    };
  }

  const application = item as ApplicationListItem;
  if (role === "admin") {
    return {
      id: application.id,
      title: application.student_user?.full_name || `Application #${application.id}`,
      subtitle: application.opportunity?.title || "Application",
      context:
        [application.student_profile?.program, application.student_profile?.student_id]
          .filter(Boolean)
          .join(" · ") || "Application thread",
      status: application.workflow?.stageLabel || "Open",
      updatedAt: application.updated_at,
      href: `/admin/applications/${application.id}`,
    };
  }

  return {
    id: application.id,
    title: application.opportunity?.title || `Application #${application.id}`,
    subtitle: application.opportunity?.term || "Submitted application",
    context: application.workflow?.currentStakeholder || application.workflow?.stageLabel || "Application thread",
    status: application.workflow?.finalStatus || application.workflow?.stageLabel || "Active",
    updatedAt: application.updated_at,
    href: `/student/applications/${application.id}`,
  };
}

function formatAuthor(authorEmail: string, currentUserEmail: string | null): string {
  if (currentUserEmail && authorEmail.toLowerCase() === currentUserEmail.toLowerCase()) return "You";
  const localPart = authorEmail.split("@")[0] || authorEmail;
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function initialsFromLabel(label: string): string {
  return label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function MessagesWorkspace({ role }: { role: RoleVariant }) {
  const config = WORKSPACE_CONFIG[role];
  const audienceOptions = role === "student" ? STUDENT_AUDIENCES : STAFF_AUDIENCES;
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [commentsById, setCommentsById] = useState<Record<number, Comment[]>>({});
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<CommentVisibility>(
    role === "student" ? "student_visible" : "internal",
  );
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((response) => (response.ok ? response.json() : null)),
      fetch(config.listEndpoint).then((response) => response.json()),
    ])
      .then(([sessionPayload, listPayload]: [SessionPayload | null, { items?: Array<ApplicationListItem | ReviewerInboxItem> }]) => {
        const normalized = Array.isArray(listPayload.items)
          ? listPayload.items.map((item) => normalizeConversation(role, item))
          : [];
        setCurrentUserEmail(sessionPayload?.user?.email?.toLowerCase() || null);
        setItems(normalized);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [config.listEndpoint, role]);

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    [items],
  );
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sortedItems;
    return sortedItems.filter((item) =>
      [item.title, item.subtitle, item.context, item.status].some((value) => value.toLowerCase().includes(query)),
    );
  }, [search, sortedItems]);
  const selectedConversation =
    filteredItems.find((item) => item.id === selectedId) || filteredItems[0] || null;

  useEffect(() => {
    if (!selectedConversation || commentsById[selectedConversation.id]) return;
    let active = true;
    fetch(`/api/applications/${selectedConversation.id}/comments`)
      .then(async (response) => {
        const payload: { comments?: Comment[]; detail?: string } = await response.json();
        if (!response.ok) throw new Error(payload.detail || "Unable to load conversation.");
        if (active) {
          setCommentsById((current) => ({
            ...current,
            [selectedConversation.id]: Array.isArray(payload.comments) ? payload.comments : [],
          }));
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load conversation.");
      });
    return () => {
      active = false;
    };
  }, [commentsById, selectedConversation]);

  const selectedComments = selectedConversation ? commentsById[selectedConversation.id] : undefined;

  useEffect(() => {
    if (!threadRef.current || !selectedComments) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [selectedComments]);

  function chooseConversation(id: number) {
    setSelectedId(id);
    setError(null);
    setMessage("");
    setVisibility(role === "student" ? "student_visible" : "internal");
  }

  async function handleSend() {
    if (!selectedConversation) return;
    const text = message.trim();
    if (!text) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/applications/${selectedConversation.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, visibility }),
      });
      const payload: { comment?: Comment; detail?: string } = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Unable to send message.");
      if (payload.comment) {
        setCommentsById((current) => ({
          ...current,
          [selectedConversation.id]: [...(current[selectedConversation.id] || []), payload.comment as Comment],
        }));
      }
      setMessage("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send message.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">{config.title}</h1>
        <p className="mt-2 max-w-2xl text-slate-500">{config.subtitle}</p>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="grid min-h-[72vh] grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50/70 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-200 px-4 py-4">
              <label className="relative block">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search conversations"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </label>
            </div>
            <div className="max-h-[72vh] overflow-y-auto">
              {loading ? (
                <div className="flex h-48 items-center justify-center text-slate-400">
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm font-semibold text-slate-700">{config.emptyTitle}</p>
                  <p className="mt-2 text-sm text-slate-500">{search ? "Try a different search term." : config.emptyBody}</p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const comments = commentsById[item.id];
                  const last = comments?.[comments.length - 1];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => chooseConversation(item.id)}
                      className={`flex w-full items-start gap-3 border-b border-slate-200/80 px-4 py-4 text-left ${
                        item.id === selectedConversation?.id ? "bg-white" : "hover:bg-white/80"
                      }`}
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xs font-bold text-white">
                        {initialsFromLabel(item.title)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                          <span className="shrink-0 text-[11px] text-slate-400">{formatTimestamp(last?.created_at || item.updatedAt)}</span>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-slate-500">{item.subtitle}</p>
                        <p className="mt-2 line-clamp-1 text-sm text-slate-600">{last?.text || "No messages yet"}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="flex min-h-[72vh] flex-col">
            {!selectedConversation ? (
              <div className="m-auto max-w-md px-6 text-center">
                <p className="text-lg font-semibold text-slate-900">{config.emptyTitle}</p>
                <p className="mt-2 text-slate-500">{config.emptyBody}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-slate-900">{selectedConversation.title}</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="neutral">{selectedConversation.context}</Badge>
                      <Badge variant="info">{selectedConversation.status}</Badge>
                    </div>
                  </div>
                  <Link href={selectedConversation.href} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    {config.openLabel}
                  </Link>
                </div>

                <div ref={threadRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-5 py-5">
                  {!selectedComments ? (
                    <div className="flex h-full min-h-52 items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined animate-spin">progress_activity</span>
                    </div>
                  ) : selectedComments.length === 0 ? (
                    <div className="m-auto max-w-sm rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
                      No messages in this application thread yet.
                    </div>
                  ) : (
                    selectedComments.map((comment) => {
                      const mine = Boolean(
                        currentUserEmail && comment.author_email.toLowerCase() === currentUserEmail.toLowerCase(),
                      );
                      return (
                        <div key={comment.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                          <div className={`max-w-[85%] rounded-[24px] px-4 py-3 text-sm leading-relaxed ${
                            mine ? "rounded-br-md bg-slate-900 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                          }`}>
                            {comment.text}
                          </div>
                          <p className="mt-1 flex items-center gap-2 px-1 text-[11px] text-slate-400">
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {labelForVisibility(comment.visibility)}
                            </span>
                            <span>{formatAuthor(comment.author_email, currentUserEmail)} · {formatTimestamp(comment.created_at)}</span>
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="border-t border-slate-200 bg-white px-5 py-4">
                  {error && <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
                  <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-2">
                    <div className="flex items-center gap-2 border-b border-slate-200 px-3 pb-2">
                      <span className="w-16 text-xs text-slate-400">Audience</span>
                      <select
                        value={visibility}
                        onChange={(event) => setVisibility(event.target.value as CommentVisibility)}
                        disabled={audienceOptions.length === 1}
                        className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                      >
                        {audienceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </div>
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      rows={3}
                      placeholder="Type a message..."
                      className="max-h-40 min-h-[5rem] w-full resize-none bg-transparent px-3 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void handleSend();
                        }
                      }}
                    />
                    <div className="flex items-center justify-between px-3 pb-1">
                      <p className="text-[11px] text-slate-400">{audienceOptions.find((option) => option.value === visibility)?.description}</p>
                      <button
                        type="button"
                        onClick={() => void handleSend()}
                        disabled={submitting || !message.trim()}
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:bg-slate-300"
                      >
                        <span className={`material-symbols-outlined text-[18px] ${submitting ? "animate-spin" : ""}`}>
                          {submitting ? "progress_activity" : "send"}
                        </span>
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
