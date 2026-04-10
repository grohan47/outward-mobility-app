"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildStakeholderOptions, labelForVisibility } from "@/components/application/chatStakeholders";
import { Badge } from "@/components/ui/Badge";

type RoleVariant = "reviewer" | "admin" | "generator";

type SessionPayload = {
  user?: {
    email?: string;
  };
};

type CommentRecord = {
  id: number;
  author_email: string;
  text: string;
  visibility: string;
  created_at: string;
};

type ConversationPreview = {
  lastText: string;
  lastAt: string;
  count: number;
};

type ConversationItem = {
  id: number;
  title: string;
  subtitle: string;
  context: string;
  status: string;
  updatedAt: string;
  href: string;
  emptyLabel: string;
};

type ApplicationDetailLike = {
  student_user?: {
    full_name?: string;
  };
  pipeline_steps?: Array<{
    step_name?: string;
    reviewer_email?: string;
    reviewer_display_name?: string;
    reviewerName?: string;
  }>;
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
    subtitle: "Application-specific conversations with a clean, focused review inbox.",
    listEndpoint: "/api/reviewer/inbox",
    emptyTitle: "No active conversations",
    emptyBody: "Applications assigned to you will appear here when there is work to review.",
    openLabel: "Open review",
  },
  admin: {
    title: "Messages",
    subtitle: "A quieter, Outlook-style view of conversations across all application threads.",
    listEndpoint: "/api/admin/applications",
    emptyTitle: "No application threads yet",
    emptyBody: "As applications move through the system, their conversations will appear here.",
    openLabel: "Open application",
  },
  generator: {
    title: "Messages",
    subtitle: "A simple inbox for comments tied to your submitted applications.",
    listEndpoint: "/api/my/applications",
    emptyTitle: "No application threads yet",
    emptyBody: "Submit an application and any related conversation will show up here.",
    openLabel: "Open application",
  },
};

function normalizeConversation(role: RoleVariant, item: any): ConversationItem {
  if (role === "reviewer") {
    return {
      id: item.id,
      title: item.student_name || `Application #${item.id}`,
      subtitle: item.opportunity_title || "Opportunity",
      context: item.student_id || "Assigned review",
      status: item.current_stage || "In review",
      updatedAt: item.updated_at,
      href: `/reviewer/applications/${item.id}`,
      emptyLabel: "No chat activity yet",
    };
  }

  if (role === "admin") {
    return {
      id: item.id,
      title: item.student_user?.full_name || `Application #${item.id}`,
      subtitle: item.opportunity?.title || "Application",
      context: [item.student_profile?.program, item.student_profile?.student_id].filter(Boolean).join(" · ") || "Application thread",
      status: item.workflow?.stageLabel || "Open",
      updatedAt: item.updated_at,
      href: `/admin/applications/${item.id}`,
      emptyLabel: "No chat activity yet",
    };
  }

  return {
    id: item.id,
    title: item.opportunity?.title || `Application #${item.id}`,
    subtitle: item.opportunity?.term || "Submitted application",
    context: item.workflow?.currentStakeholder || item.workflow?.stageLabel || "Application thread",
    status: item.workflow?.finalStatus || item.workflow?.stageLabel || "Active",
    updatedAt: item.updated_at,
    href: `/generator/applications/${item.id}`,
    emptyLabel: "No comments on this application yet",
  };
}

function formatAuthor(authorEmail: string, currentUserEmail: string | null): string {
  if (currentUserEmail && authorEmail.toLowerCase() === currentUserEmail.toLowerCase()) {
    return "You";
  }

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

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [previews, setPreviews] = useState<Record<number, ConversationPreview>>({});
  const [commentsById, setCommentsById] = useState<Record<number, CommentRecord[]>>({});
  const [detailById, setDetailById] = useState<Record<number, ApplicationDetailLike>>({});
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [threadKey, setThreadKey] = useState("all");
  const [recipientKey, setRecipientKey] = useState("internal");
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    Promise.all([
      // Frontend -> API: GET /api/auth/me
      fetch("/api/auth/me").then((response) => (response.ok ? response.json() : null)),
      // Frontend -> API: GET /api/{role-specific inbox list}
      fetch(config.listEndpoint).then((response) => response.json()),
    ])
      .then(([sessionPayload, listPayload]: [SessionPayload | null, any]) => {
        const normalized = Array.isArray(listPayload?.items)
          ? listPayload.items.map((item: any) => normalizeConversation(role, item))
          : [];
        setCurrentUserEmail(sessionPayload?.user?.email?.toLowerCase() || null);
        setItems(normalized);
        setSelectedId(normalized[0]?.id ?? null);
      })
      .catch(() => {
        setItems([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [config.listEndpoint, role]);

  const sortedItems = useMemo(() => {
    const copy = [...items];
    copy.sort((left, right) => {
      const leftTime = previews[left.id]?.lastAt || left.updatedAt;
      const rightTime = previews[right.id]?.lastAt || right.updatedAt;
      return new Date(rightTime).getTime() - new Date(leftTime).getTime();
    });
    return copy;
  }, [items, previews]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sortedItems;

    return sortedItems.filter((item) =>
      [item.title, item.subtitle, item.context, item.status].some((value) => value.toLowerCase().includes(query)),
    );
  }, [search, sortedItems]);

  const selectedConversation = useMemo(
    () => filteredItems.find((item) => item.id === selectedId) || filteredItems[0] || null,
    [filteredItems, selectedId],
  );

  useEffect(() => {
    if (!selectedConversation && filteredItems[0]) {
      setSelectedId(filteredItems[0].id);
      return;
    }
    if (selectedConversation && selectedConversation.id !== selectedId) {
      setSelectedId(selectedConversation.id);
    }
  }, [filteredItems, selectedConversation, selectedId]);

  useEffect(() => {
    setThreadKey("all");
    setRecipientKey("internal");
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (threadKey !== "all") {
      setRecipientKey(threadKey);
    }
  }, [threadKey]);

  useEffect(() => {
    const previewTargets = sortedItems.slice(0, 16).filter((item) => !previews[item.id]);
    if (previewTargets.length === 0) return;

    Promise.allSettled(
      previewTargets.map(async (item) => {
        // Frontend -> API: GET /api/applications/:id/comments
        const response = await fetch(`/api/applications/${item.id}/comments`);
        const payload = await response.json();
        const comments = Array.isArray(payload?.comments) ? (payload.comments as CommentRecord[]) : [];
        const last = comments[comments.length - 1];
        return {
          id: item.id,
          preview: last
            ? {
                lastText: last.text,
                lastAt: last.created_at,
                count: comments.length,
              }
            : {
                lastText: item.emptyLabel,
                lastAt: item.updatedAt,
                count: 0,
              },
        };
      }),
    ).then((results) => {
      const nextPreviews: Record<number, ConversationPreview> = {};
      for (const result of results) {
        if (result.status === "fulfilled") {
          nextPreviews[result.value.id] = result.value.preview;
        }
      }
      if (Object.keys(nextPreviews).length > 0) {
        setPreviews((current) => ({ ...current, ...nextPreviews }));
      }
    });
  }, [previews, sortedItems]);

  useEffect(() => {
    if (!selectedConversation) return;
    if (commentsById[selectedConversation.id]) return;

    setThreadLoading(true);
    setError(null);

    // Frontend -> API: GET /api/applications/:id/comments
    fetch(`/api/applications/${selectedConversation.id}/comments`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.detail || "Unable to load conversation.");
        }
        const comments = Array.isArray(payload?.comments) ? (payload.comments as CommentRecord[]) : [];
        setCommentsById((current) => ({ ...current, [selectedConversation.id]: comments }));
        const last = comments[comments.length - 1];
        setPreviews((current) => ({
          ...current,
          [selectedConversation.id]: last
            ? {
                lastText: last.text,
                lastAt: last.created_at,
                count: comments.length,
              }
            : {
                lastText: selectedConversation.emptyLabel,
                lastAt: selectedConversation.updatedAt,
                count: 0,
              },
        }));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to load conversation.");
      })
      .finally(() => {
        setThreadLoading(false);
      });
  }, [commentsById, selectedConversation]);

  useEffect(() => {
    if (!selectedConversation) return;
    if (detailById[selectedConversation.id]) return;

    // Frontend -> API: GET /api/applications/:id
    fetch(`/api/applications/${selectedConversation.id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: ApplicationDetailLike | null) => {
        if (payload) {
          setDetailById((current) => ({ ...current, [selectedConversation.id]: payload }));
        }
      })
      .catch(() => {
        // Keep selector functional with fallback labels even if detail hydration fails.
      });
  }, [detailById, selectedConversation]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [selectedConversation, commentsById, threadKey]);

  async function handleSend() {
    if (!selectedConversation) return;

    const text = message.trim();
    if (!text) return;

    setSubmitting(true);
    setError(null);

    try {
      // Frontend -> API: POST /api/applications/:id/comments
      const response = await fetch(`/api/applications/${selectedConversation.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          visibility: recipientKey,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || "Unable to send message.");
      }

      const nextComment = payload?.comment as CommentRecord | undefined;
      if (!nextComment) return;

      setCommentsById((current) => ({
        ...current,
        [selectedConversation.id]: [...(current[selectedConversation.id] || []), nextComment],
      }));
      setPreviews((current) => ({
        ...current,
        [selectedConversation.id]: {
          lastText: nextComment.text,
          lastAt: nextComment.created_at,
          count: (current[selectedConversation.id]?.count || 0) + 1,
        },
      }));
      setItems((current) =>
        current.map((item) =>
          item.id === selectedConversation.id ? { ...item, updatedAt: nextComment.created_at } : item,
        ),
      );
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedDetail = selectedConversation ? detailById[selectedConversation.id] : null;
  const stakeholderOptions = buildStakeholderOptions({
    studentName:
      selectedDetail?.student_user?.full_name ||
      (role === "generator" ? "Student" : selectedConversation?.title || "Student"),
    pipelineSteps: selectedDetail?.pipeline_steps || [],
  });
  const selectedComments =
    selectedConversation
      ? (commentsById[selectedConversation.id] || []).filter((comment) =>
          threadKey === "all" ? true : (comment.visibility || "internal").toLowerCase() === threadKey,
        )
      : [];
  const conversationsWithMessages = Object.values(previews).filter((preview) => preview.count > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">{config.title}</h1>
          <p className="mt-2 max-w-2xl text-slate-500">{config.subtitle}</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Threads</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{loading ? "—" : items.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Active Chats</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{loading ? "—" : conversationsWithMessages}</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="grid min-h-[72vh] grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50/70 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-200 px-4 py-4">
              <label className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-slate-400">
                  search
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search conversations"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300"
                />
              </label>
            </div>

            <div className="max-h-[72vh] overflow-y-auto">
              {loading ? (
                <div className="flex h-48 items-center justify-center text-sm text-slate-400">
                  <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm font-semibold text-slate-700">{config.emptyTitle}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {search ? "Try a different search term." : config.emptyBody}
                  </p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const preview = previews[item.id];
                  const active = item.id === selectedConversation?.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`flex w-full items-start gap-3 border-b border-slate-200/80 px-4 py-4 text-left transition-colors ${
                        active ? "bg-white" : "hover:bg-white/80"
                      }`}
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xs font-bold text-white">
                        {initialsFromLabel(item.title)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {formatTimestamp(preview?.lastAt || item.updatedAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-slate-500">{item.subtitle}</p>
                        <p className="mt-2 line-clamp-1 text-sm text-slate-600">
                          {preview?.lastText || item.emptyLabel}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                            {item.status}
                          </span>
                          {preview && preview.count > 0 && (
                            <span className="text-[11px] text-slate-400">{preview.count} message{preview.count === 1 ? "" : "s"}</span>
                          )}
                        </div>
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
                <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
                        {initialsFromLabel(selectedConversation.title)}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold text-slate-900">{selectedConversation.title}</h2>
                        <p className="truncate text-sm text-slate-500">{selectedConversation.subtitle}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="neutral">{selectedConversation.context}</Badge>
                      <Badge variant="info">{selectedConversation.status}</Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <span className="w-10 text-slate-400">View</span>
                      <select
                        value={threadKey}
                        onChange={(event) => setThreadKey(event.target.value)}
                        className="h-9 min-w-[220px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none"
                      >
                        <option value="all">All messages</option>
                        {stakeholderOptions.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Link
                    href={selectedConversation.href}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    {config.openLabel}
                  </Link>
                </div>

                <div ref={threadRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-5 py-5">
                  {threadLoading ? (
                    <div className="flex h-full min-h-52 items-center justify-center text-sm text-slate-400">
                      <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                    </div>
                  ) : selectedComments.length === 0 ? (
                    <div className="m-auto max-w-sm rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
                      <p className="text-sm font-semibold text-slate-900">No messages in this thread yet</p>
                      <p className="mt-2 text-sm text-slate-500">
                        {threadKey === "all" ? "Send the first application-specific note from here." : "Start the stakeholder-specific thread from here."}
                      </p>
                    </div>
                  ) : (
                    selectedComments.map((comment) => {
                      const mine =
                        currentUserEmail && comment.author_email.toLowerCase() === currentUserEmail.toLowerCase();
                      const threadLabel = labelForVisibility(comment.visibility, stakeholderOptions);

                      return (
                        <div key={comment.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                          <div
                            className={`max-w-[85%] rounded-[24px] px-4 py-3 text-sm leading-relaxed ${
                              mine
                                ? "rounded-br-md bg-slate-900 text-white"
                                : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            {comment.text}
                          </div>
                          <p className="mt-1 flex items-center gap-2 px-1 text-[11px] text-slate-400">
                            {threadKey === "all" && threadLabel && (
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                {threadLabel}
                              </span>
                            )}
                            <span>
                              {formatAuthor(comment.author_email, currentUserEmail)} · {formatTimestamp(comment.created_at)}
                            </span>
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="border-t border-slate-200 bg-white px-5 py-4">
                  {error && (
                    <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {error}
                    </div>
                  )}
                  <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-2">
                    <div className="flex items-center gap-2 border-b border-slate-200 px-3 pb-2">
                      <span className="w-10 text-xs text-slate-400">To</span>
                      <select
                        value={recipientKey}
                        onChange={(event) => {
                          const nextKey = event.target.value;
                          setRecipientKey(nextKey);
                          if (threadKey !== "all") {
                            setThreadKey(nextKey);
                          }
                        }}
                        className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                      >
                        {stakeholderOptions.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      rows={2}
                      placeholder="Write a message for this application"
                      className="min-h-[3.25rem] w-full resize-none bg-transparent px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void handleSend();
                        }
                      }}
                    />
                    <div className="flex items-center justify-between px-3 pb-1 pt-2">
                      <p className="text-[11px] text-slate-400">Press Enter to send</p>
                      <button
                        type="button"
                        onClick={() => void handleSend()}
                        disabled={submitting || !message.trim()}
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {submitting ? (
                          <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-[18px]">send</span>
                        )}
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
