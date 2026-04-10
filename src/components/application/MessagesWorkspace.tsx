"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";

type RoleVariant = "reviewer" | "admin" | "generator";

type SessionPayload = {
  user?: {
    email?: string;
    userId?: number;
  };
};

type ChatParticipant = {
  userId: number;
  fullName: string;
  email: string;
  kind: string;
  contextLabels: string[];
};

type ChatMessage = {
  id: number;
  body: string;
  createdAt: string;
  sender: {
    userId: number;
    fullName: string;
    email: string;
  };
};

type ChatThread = {
  id: number;
  participants: ChatParticipant[];
  participantCount: number;
  messageCount: number;
  lastMessage: ChatMessage | null;
};

type ChatApplicationSummary = {
  id: number;
  opportunityTitle?: string;
  opportunityTerm?: string | null;
  currentStage?: string;
  updatedAt?: string;
  applicant?: {
    userId: number;
    fullName: string;
    email: string;
  };
};

type InboxItem = {
  applicationId: number;
  opportunityTitle?: string;
  currentStage?: string;
  updatedAt?: string;
  applicant?: {
    userId: number;
    fullName: string;
    email: string;
  };
  visibleThreadCount: number;
  lastMessage?: ChatMessage | null;
};

type ApplicationDetailPayload = {
  application: ChatApplicationSummary;
  eligibleParticipants: ChatParticipant[];
  threads: ChatThread[];
  canAddExternalStakeholder: boolean;
};

type ThreadDetailPayload = {
  application: ChatApplicationSummary;
  eligibleParticipants: ChatParticipant[];
  thread: ChatThread;
  messages: ChatMessage[];
  canAddExternalStakeholder: boolean;
};

const WORKSPACE_CONFIG: Record<RoleVariant, { title: string; subtitle: string; emptyTitle: string; emptyBody: string; openLabel: string }> = {
  reviewer: {
    title: "Messages",
    subtitle: "Application-scoped threads with stakeholders you were added to.",
    emptyTitle: "No chat threads yet",
    emptyBody: "Threads will appear here after you are added to an application conversation.",
    openLabel: "Open review",
  },
  admin: {
    title: "Messages",
    subtitle: "Application-based stakeholder conversations with explicit thread membership.",
    emptyTitle: "No chat threads yet",
    emptyBody: "Only threads you participate in will appear in this inbox.",
    openLabel: "Open application",
  },
  generator: {
    title: "Messages",
    subtitle: "A focused inbox of application threads you are actually part of.",
    emptyTitle: "No chat threads yet",
    emptyBody: "Once you are part of an application thread, it will show up here.",
    openLabel: "Open application",
  },
};

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function initialsFromLabel(label: string): string {
  return label.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
}

function formatParticipantLabel(participant: ChatParticipant): string {
  return participant.fullName || participant.email;
}

function formatParticipantSubtitle(participant: ChatParticipant): string {
  return participant.contextLabels.length > 0 ? participant.contextLabels.join(" · ") : participant.email;
}

function formatThreadTitle(thread: ChatThread, currentUserId: number | null): string {
  const others = thread.participants.filter((participant) => participant.userId !== currentUserId);
  const labels = (others.length > 0 ? others : thread.participants).map(formatParticipantLabel);
  return labels.join(", ");
}

function formatThreadContext(thread: ChatThread): string {
  const labels = Array.from(new Set(thread.participants.flatMap((participant) => participant.contextLabels).filter(Boolean)));
  return labels.join(" · ") || `${thread.participantCount} participants`;
}

function matchesSearch(values: Array<string | null | undefined>, query: string): boolean {
  return values.some((value) => (value || "").toLowerCase().includes(query));
}

export function MessagesWorkspace({ role }: { role: RoleVariant }) {
  const config = WORKSPACE_CONFIG[role];
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [applicationDetails, setApplicationDetails] = useState<Record<number, ApplicationDetailPayload>>({});
  const [threadMessages, setThreadMessages] = useState<Record<number, ChatMessage[]>>({});
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [newThreadParticipantIds, setNewThreadParticipantIds] = useState<number[]>([]);
  const [addParticipantIds, setAddParticipantIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addingParticipants, setAddingParticipants] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

  async function loadInbox(preferredApplicationId?: number | null) {
    const [sessionResponse, inboxResponse] = await Promise.all([fetch("/api/auth/me"), fetch("/api/chat/inbox")]);
    const sessionPayload: SessionPayload | null = sessionResponse.ok ? await sessionResponse.json() : null;
    const inboxPayload = await inboxResponse.json();
    const items = Array.isArray(inboxPayload?.items) ? (inboxPayload.items as InboxItem[]) : [];

    setCurrentUserEmail(sessionPayload?.user?.email?.toLowerCase() || null);
    setCurrentUserId(sessionPayload?.user?.userId ?? null);
    setInboxItems(items);

    const nextApplicationId =
      preferredApplicationId && items.some((item) => item.applicationId === preferredApplicationId)
        ? preferredApplicationId
        : items[0]?.applicationId ?? null;
    setSelectedApplicationId(nextApplicationId);
  }

  async function loadApplication(applicationId: number, preferredThreadId?: number | null) {
    setApplicationLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/chat/applications/${applicationId}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || "Unable to load chat application.");

      const detail = payload as ApplicationDetailPayload;
      setApplicationDetails((current) => ({ ...current, [applicationId]: detail }));
      setNewThreadParticipantIds([]);

      const nextThreadId =
        preferredThreadId && detail.threads.some((thread) => thread.id === preferredThreadId)
          ? preferredThreadId
          : detail.threads[0]?.id ?? null;
      setSelectedThreadId(nextThreadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load chat application.");
      setSelectedThreadId(null);
    } finally {
      setApplicationLoading(false);
    }
  }

  async function loadThread(threadId: number) {
    setThreadLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/chat/threads/${threadId}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || "Unable to load chat thread.");

      const detail = payload as ThreadDetailPayload;
      setThreadMessages((current) => ({ ...current, [threadId]: detail.messages || [] }));
      setApplicationDetails((current) => {
        const applicationId = detail.application.id;
        const existing = current[applicationId];
        return {
          ...current,
          [applicationId]: {
            application: detail.application,
            eligibleParticipants: detail.eligibleParticipants,
            threads: existing?.threads.map((thread) => (thread.id === detail.thread.id ? detail.thread : thread)) || [detail.thread],
            canAddExternalStakeholder: detail.canAddExternalStakeholder,
          },
        };
      });
      setAddParticipantIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load chat thread.");
    } finally {
      setThreadLoading(false);
    }
  }

  useEffect(() => {
    loadInbox()
      .catch(() => {
        setInboxItems([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedApplicationId) {
      setSelectedThreadId(null);
      return;
    }
    void loadApplication(selectedApplicationId, selectedThreadId);
  }, [selectedApplicationId]);

  useEffect(() => {
    if (!selectedThreadId) return;
    if (threadMessages[selectedThreadId]) return;
    void loadThread(selectedThreadId);
  }, [selectedThreadId, threadMessages]);

  useEffect(() => {
    if (!selectedThreadId) return;
    const timer = window.setInterval(() => {
      void loadThread(selectedThreadId);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [selectedThreadId]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [selectedThreadId, threadMessages]);

  const filteredInbox = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return inboxItems;
    return inboxItems.filter((item) =>
      matchesSearch(
        [item.opportunityTitle, item.currentStage, item.applicant?.fullName, item.lastMessage?.body],
        query,
      ),
    );
  }, [inboxItems, search]);

  const selectedApplication = selectedApplicationId ? applicationDetails[selectedApplicationId] : null;
  const selectedThread =
    selectedThreadId && selectedApplication
      ? selectedApplication.threads.find((thread) => thread.id === selectedThreadId) || null
      : null;
  const selectedMessages = selectedThreadId ? threadMessages[selectedThreadId] || [] : [];

  const availableNewThreadParticipants = useMemo(() => {
    if (!selectedApplication) return [];
    return selectedApplication.eligibleParticipants.filter((participant) => participant.userId !== currentUserId);
  }, [currentUserId, selectedApplication]);

  const availableAddParticipants = useMemo(() => {
    if (!selectedApplication || !selectedThread) return [];
    const existingIds = new Set(selectedThread.participants.map((participant) => participant.userId));
    return selectedApplication.eligibleParticipants.filter((participant) => !existingIds.has(participant.userId));
  }, [selectedApplication, selectedThread]);

  async function handleCreateThread() {
    if (!selectedApplicationId) return;
    const participantIds = newThreadParticipantIds.filter(Boolean);
    const text = message.trim();
    if (participantIds.length === 0 || !text) {
      setError("Select at least one stakeholder and write the first message.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/chat/applications/${selectedApplicationId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantUserIds: participantIds, initialMessage: text }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || "Unable to create chat thread.");

      const thread = payload.thread as ChatThread;
      const messages = Array.isArray(payload.messages) ? (payload.messages as ChatMessage[]) : [];
      setApplicationDetails((current) => {
        const existing = current[selectedApplicationId];
        if (!existing) return current;
        return {
          ...current,
          [selectedApplicationId]: {
            ...existing,
            threads: [thread, ...existing.threads.filter((item) => item.id !== thread.id)],
          },
        };
      });
      setThreadMessages((current) => ({ ...current, [thread.id]: messages }));
      setSelectedThreadId(thread.id);
      setMessage("");
      setNewThreadParticipantIds([]);
      await loadInbox(selectedApplicationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create chat thread.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendMessage() {
    if (!selectedThreadId || !selectedApplicationId) return;
    const text = message.trim();
    if (!text) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/chat/threads/${selectedThreadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || "Unable to send message.");

      const nextMessage = payload.message as ChatMessage | null;
      const nextThread = payload.thread as ChatThread;
      if (nextMessage) {
        setThreadMessages((current) => ({
          ...current,
          [selectedThreadId]: [...(current[selectedThreadId] || []), nextMessage],
        }));
      }
      setApplicationDetails((current) => {
        const existing = current[selectedApplicationId];
        if (!existing) return current;
        return {
          ...current,
          [selectedApplicationId]: {
            ...existing,
            threads: existing.threads.map((thread) => (thread.id === nextThread.id ? nextThread : thread)),
          },
        };
      });
      setMessage("");
      await loadInbox(selectedApplicationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddParticipants() {
    if (!selectedThreadId || addParticipantIds.length === 0 || !selectedApplicationId) return;

    setAddingParticipants(true);
    setError(null);
    try {
      const response = await fetch(`/api/chat/threads/${selectedThreadId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantUserIds: addParticipantIds }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || "Unable to add participants.");

      const nextThread = payload.thread as ChatThread;
      const eligibleParticipants = Array.isArray(payload.eligibleParticipants)
        ? (payload.eligibleParticipants as ChatParticipant[])
        : selectedApplication?.eligibleParticipants || [];
      setApplicationDetails((current) => {
        const existing = current[selectedApplicationId];
        if (!existing) return current;
        return {
          ...current,
          [selectedApplicationId]: {
            ...existing,
            eligibleParticipants,
            threads: existing.threads.map((thread) => (thread.id === nextThread.id ? nextThread : thread)),
            canAddExternalStakeholder: Boolean(payload.canAddExternalStakeholder),
          },
        };
      });
      setAddParticipantIds([]);
      await loadInbox(selectedApplicationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add participants.");
    } finally {
      setAddingParticipants(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">{config.title}</h1>
          <p className="mt-2 max-w-2xl text-slate-500">{config.subtitle}</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Applications</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{loading ? "—" : inboxItems.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Visible Threads</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{selectedApplication?.threads.length ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="grid min-h-[72vh] grid-cols-1 lg:grid-cols-[320px_360px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50/70 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-200 px-4 py-4">
              <label className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-slate-400">
                  search
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search applications"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 outline-none"
                />
              </label>
            </div>

            <div className="max-h-[72vh] overflow-y-auto">
              {loading ? (
                <div className="flex h-48 items-center justify-center text-sm text-slate-400">
                  <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                </div>
              ) : filteredInbox.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm font-semibold text-slate-700">{config.emptyTitle}</p>
                  <p className="mt-2 text-sm text-slate-500">{search ? "Try a different search term." : config.emptyBody}</p>
                </div>
              ) : (
                filteredInbox.map((item) => {
                  const active = item.applicationId === selectedApplicationId;
                  return (
                    <button
                      key={item.applicationId}
                      type="button"
                      onClick={() => setSelectedApplicationId(item.applicationId)}
                      className={`flex w-full flex-col gap-2 border-b border-slate-200/80 px-4 py-4 text-left transition-colors ${
                        active ? "bg-white" : "hover:bg-white/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {item.opportunityTitle || `Application #${item.applicationId}`}
                        </p>
                        <span className="shrink-0 text-[11px] text-slate-400">{formatTimestamp(item.lastMessage?.createdAt || item.updatedAt)}</span>
                      </div>
                      <p className="truncate text-sm text-slate-500">{item.applicant?.fullName || "Applicant"}</p>
                      <p className="line-clamp-1 text-sm text-slate-600">{item.lastMessage?.body || "No thread messages yet"}</p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          {item.currentStage || "Active"}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {item.visibleThreadCount} thread{item.visibleThreadCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>
          <section className="flex min-h-[72vh] flex-col">
            {!selectedApplicationId ? (
              <div className="m-auto max-w-md px-6 text-center">
                <p className="text-lg font-semibold text-slate-900">{config.emptyTitle}</p>
                <p className="mt-2 text-slate-500">{config.emptyBody}</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold text-slate-900">
                        {selectedApplication?.application.opportunityTitle || `Application #${selectedApplicationId}`}
                      </h2>
                      <p className="truncate text-sm text-slate-500">
                        {selectedApplication?.application.applicant?.fullName || "Applicant"}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge variant="neutral">{selectedApplication?.application.currentStage || "Active"}</Badge>
                        {selectedApplication?.application.opportunityTerm && (
                          <Badge variant="info">{selectedApplication.application.opportunityTerm}</Badge>
                        )}
                      </div>
                    </div>
                    <Link
                      href={
                        role === "reviewer"
                          ? `/reviewer/applications/${selectedApplicationId}`
                          : role === "admin"
                            ? `/admin/applications/${selectedApplicationId}`
                            : `/generator/applications/${selectedApplicationId}`
                      }
                      className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                    >
                      {config.openLabel}
                    </Link>
                  </div>

                  {selectedThread ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {selectedThread.participants.map((participant) => (
                          <span
                            key={participant.userId}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                          >
                            {formatParticipantLabel(participant)}
                            {participant.contextLabels.length > 0 ? ` · ${participant.contextLabels.join(", ")}` : ""}
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:flex-row md:items-end">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Add Participant</p>
                          <select
                            multiple
                            value={addParticipantIds.map(String)}
                            onChange={(event) =>
                              setAddParticipantIds(Array.from(event.target.selectedOptions, (option) => Number(option.value)))
                            }
                            className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                          >
                            {availableAddParticipants.map((participant) => (
                              <option key={participant.userId} value={participant.userId}>
                                {formatParticipantLabel(participant)} - {formatParticipantSubtitle(participant)}
                              </option>
                            ))}
                          </select>
                          <p className="mt-2 text-[11px] text-slate-400">
                            Any current participant can add any stakeholder defined in the opportunity workflow.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled
                            className="inline-flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-300"
                            title="Add extra member coming later"
                          >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleAddParticipants()}
                            disabled={addingParticipants || addParticipantIds.length === 0}
                            className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {addingParticipants ? (
                              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                            ) : (
                              <span className="material-symbols-outlined text-[18px]">group_add</span>
                            )}
                            Add
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">Pick a thread or start a new one from the stakeholder dropdown.</p>
                  )}
                </div>

                <div ref={threadRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-5 py-5">
                  {threadLoading ? (
                    <div className="flex h-full min-h-52 items-center justify-center text-sm text-slate-400">
                      <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                    </div>
                  ) : !selectedThread ? (
                    <div className="m-auto max-w-sm rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
                      <p className="text-sm font-semibold text-slate-900">No thread selected</p>
                      <p className="mt-2 text-sm text-slate-500">Create a new thread from the opportunity stakeholder list on the left.</p>
                    </div>
                  ) : selectedMessages.length === 0 ? (
                    <div className="m-auto max-w-sm rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
                      <p className="text-sm font-semibold text-slate-900">No messages yet</p>
                      <p className="mt-2 text-sm text-slate-500">Send the first message in this stakeholder thread.</p>
                    </div>
                  ) : (
                    selectedMessages.map((chatMessage) => {
                      const mine =
                        currentUserEmail && chatMessage.sender.email.toLowerCase() === currentUserEmail.toLowerCase();

                      return (
                        <div key={chatMessage.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                          <div
                            className={`max-w-[85%] rounded-[24px] px-4 py-3 text-sm leading-relaxed ${
                              mine
                                ? "rounded-br-md bg-slate-900 text-white"
                                : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            {chatMessage.body}
                          </div>
                          <p className="mt-1 px-1 text-[11px] text-slate-400">
                            {mine ? "You" : chatMessage.sender.fullName} · {formatTimestamp(chatMessage.createdAt)}
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
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      rows={2}
                      placeholder={selectedThread ? "Write a message for this thread" : "Write the first message for the new thread"}
                      className="min-h-[3.25rem] w-full resize-none bg-transparent px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          if (selectedThread) {
                            void handleSendMessage();
                          } else {
                            void handleCreateThread();
                          }
                        }
                      }}
                    />
                    <div className="flex items-center justify-between px-3 pb-1 pt-2">
                      <p className="text-[11px] text-slate-400">
                        {selectedThread
                          ? "Any participant can add more opportunity stakeholders to this thread."
                          : "Select opportunity-defined stakeholders, then send the first message."}
                      </p>
                      <button
                        type="button"
                        onClick={() => void (selectedThread ? handleSendMessage() : handleCreateThread())}
                        disabled={submitting || !message.trim() || (!selectedThread && newThreadParticipantIds.length === 0)}
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {submitting ? (
                          <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-[18px]">{selectedThread ? "send" : "chat"}</span>
                        )}
                        {selectedThread ? "Send" : "Create Thread"}
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
