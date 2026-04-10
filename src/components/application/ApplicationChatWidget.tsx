"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

type ChatApplicationPayload = {
  eligibleParticipants: ChatParticipant[];
  threads: ChatThread[];
  canAddExternalStakeholder: boolean;
};

type ChatThreadPayload = {
  eligibleParticipants: ChatParticipant[];
  thread: ChatThread;
  messages: ChatMessage[];
  canAddExternalStakeholder: boolean;
};

type SessionPayload = {
  user?: {
    email?: string;
    userId?: number;
  };
};

interface ApplicationChatWidgetProps {
  applicationId: number;
  contextLabel: string;
  visible?: boolean;
  studentName?: string | null;
  pipelineSteps?: Array<{
    step_name?: string;
    reviewer_email?: string;
    reviewer_display_name?: string;
    reviewerName?: string;
  }>;
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "";
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

export function ApplicationChatWidget({
  applicationId,
  contextLabel,
  visible = true,
}: ApplicationChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addingParticipants, setAddingParticipants] = useState(false);
  const [message, setMessage] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [applicationData, setApplicationData] = useState<ChatApplicationPayload | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [threadMessages, setThreadMessages] = useState<Record<number, ChatMessage[]>>({});
  const [newThreadParticipantIds, setNewThreadParticipantIds] = useState<number[]>([]);
  const [addParticipantIds, setAddParticipantIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  async function loadApplication(preferredThreadId?: number | null) {
    setLoading(true);
    setError(null);
    try {
      const [sessionResponse, applicationResponse] = await Promise.all([
        fetch("/api/auth/me"),
        fetch(`/api/chat/applications/${applicationId}`),
      ]);
      const sessionPayload: SessionPayload | null = sessionResponse.ok ? await sessionResponse.json() : null;
      const payload = await applicationResponse.json();
      if (!applicationResponse.ok) {
        throw new Error(payload?.detail || "Unable to load chat.");
      }

      const detail = payload as ChatApplicationPayload;
      setCurrentUserEmail(sessionPayload?.user?.email?.toLowerCase() || null);
      setCurrentUserId(sessionPayload?.user?.userId ?? null);
      setApplicationData(detail);
      setNewThreadParticipantIds([]);

      const nextThreadId =
        preferredThreadId && detail.threads.some((thread) => thread.id === preferredThreadId)
          ? preferredThreadId
          : detail.threads[0]?.id ?? null;
      setSelectedThreadId(nextThreadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load chat.");
    } finally {
      setLoading(false);
    }
  }

  async function loadThread(threadId: number) {
    setThreadLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/chat/threads/${threadId}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || "Unable to load thread.");
      }
      const detail = payload as ChatThreadPayload;
      setThreadMessages((current) => ({ ...current, [threadId]: detail.messages || [] }));
      setApplicationData((current) =>
        current
          ? {
              ...current,
              eligibleParticipants: detail.eligibleParticipants,
              threads: current.threads.map((thread) => (thread.id === detail.thread.id ? detail.thread : thread)),
              canAddExternalStakeholder: detail.canAddExternalStakeholder,
            }
          : current,
      );
      setAddParticipantIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load thread.");
    } finally {
      setThreadLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !visible) return;
    void loadApplication(selectedThreadId);
  }, [applicationId, open, visible]);

  useEffect(() => {
    if (!open || !selectedThreadId) return;
    void loadThread(selectedThreadId);
  }, [open, selectedThreadId]);

  useEffect(() => {
    if (!open || !selectedThreadId) return;
    const timer = window.setInterval(() => {
      void loadThread(selectedThreadId);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [open, selectedThreadId]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, selectedThreadId, threadMessages]);

  const selectedThread = applicationData?.threads.find((thread) => thread.id === selectedThreadId) || null;
  const selectedMessages = selectedThreadId ? threadMessages[selectedThreadId] || [] : [];

  const availableNewThreadParticipants = useMemo(() => {
    if (!applicationData) return [];
    return applicationData.eligibleParticipants.filter((participant) => participant.userId !== currentUserId);
  }, [applicationData, currentUserId]);

  const availableAddParticipants = useMemo(() => {
    if (!applicationData || !selectedThread) return [];
    const existingIds = new Set(selectedThread.participants.map((participant) => participant.userId));
    return applicationData.eligibleParticipants.filter((participant) => !existingIds.has(participant.userId));
  }, [applicationData, selectedThread]);

  async function handleCreateThread() {
    const participantIds = newThreadParticipantIds.filter(Boolean);
    const text = message.trim();
    if (participantIds.length === 0 || !text) {
      setError("Select at least one stakeholder and write the first message.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/chat/applications/${applicationId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantUserIds: participantIds,
          initialMessage: text,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || "Unable to create thread.");
      }

      const thread = payload.thread as ChatThread;
      const messages = Array.isArray(payload.messages) ? (payload.messages as ChatMessage[]) : [];
      setApplicationData((current) =>
        current
          ? {
              ...current,
              threads: [thread, ...current.threads.filter((item) => item.id !== thread.id)],
            }
          : current,
      );
      setThreadMessages((current) => ({ ...current, [thread.id]: messages }));
      setSelectedThreadId(thread.id);
      setMessage("");
      setNewThreadParticipantIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create thread.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendMessage() {
    if (!selectedThreadId) return;
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
      if (!response.ok) {
        throw new Error(payload?.detail || "Unable to send message.");
      }

      const nextMessage = payload.message as ChatMessage | null;
      const nextThread = payload.thread as ChatThread;
      if (nextMessage) {
        setThreadMessages((current) => ({
          ...current,
          [selectedThreadId]: [...(current[selectedThreadId] || []), nextMessage],
        }));
      }
      setApplicationData((current) =>
        current
          ? {
              ...current,
              threads: current.threads.map((thread) => (thread.id === nextThread.id ? nextThread : thread)),
            }
          : current,
      );
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddParticipants() {
    if (!selectedThreadId || addParticipantIds.length === 0) return;

    setAddingParticipants(true);
    setError(null);
    try {
      const response = await fetch(`/api/chat/threads/${selectedThreadId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantUserIds: addParticipantIds }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || "Unable to add participants.");
      }

      const nextThread = payload.thread as ChatThread;
      const eligibleParticipants = Array.isArray(payload.eligibleParticipants)
        ? (payload.eligibleParticipants as ChatParticipant[])
        : applicationData?.eligibleParticipants || [];
      setApplicationData((current) =>
        current
          ? {
              ...current,
              eligibleParticipants,
              threads: current.threads.map((thread) => (thread.id === nextThread.id ? nextThread : thread)),
              canAddExternalStakeholder: Boolean(payload.canAddExternalStakeholder),
            }
          : current,
      );
      setAddParticipantIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add participants.");
    } finally {
      setAddingParticipants(false);
    }
  }

  if (!visible) return null;

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 w-[calc(100vw-2rem)] max-w-[30rem] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 md:right-6">
          <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Application Chat</p>
              <p className="mt-1 text-xs text-slate-500">{contextLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close application chat"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Threads</p>
            <div className="mt-2 max-h-36 space-y-2 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-4 text-sm text-slate-400">
                  <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                </div>
              ) : (applicationData?.threads || []).length === 0 ? (
                <p className="text-sm text-slate-500">No threads yet. Start one below.</p>
              ) : (
                applicationData?.threads.map((thread) => {
                  const active = thread.id === selectedThreadId;
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors ${
                        active ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xs font-bold text-white">
                        {initialsFromLabel(formatThreadTitle(thread, currentUserId))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{formatThreadTitle(thread, currentUserId)}</p>
                        <p className="mt-1 line-clamp-1 text-xs text-slate-500">{thread.lastMessage?.body || "No messages yet"}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {selectedThread && (
            <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {selectedThread.participants.map((participant) => (
                  <span
                    key={participant.userId}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700"
                  >
                    {formatParticipantLabel(participant)}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-end gap-2">
                <select
                  multiple
                  value={addParticipantIds.map(String)}
                  onChange={(event) =>
                    setAddParticipantIds(Array.from(event.target.selectedOptions, (option) => Number(option.value)))
                  }
                  className="min-h-20 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                >
                  {availableAddParticipants.map((participant) => (
                    <option key={participant.userId} value={participant.userId}>
                      {formatParticipantLabel(participant)} - {formatParticipantSubtitle(participant)}
                    </option>
                  ))}
                </select>
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
                  {addingParticipants ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          )}

          <div
            ref={listRef}
            className="flex max-h-[22rem] min-h-[16rem] flex-col gap-3 overflow-y-auto bg-slate-50/80 px-4 py-4"
          >
            {threadLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            ) : !selectedThread ? (
              <div className="m-auto max-w-xs text-center">
                <p className="text-sm font-medium text-slate-700">No thread selected.</p>
                <p className="mt-1 text-xs text-slate-500">Choose an existing thread or start one with opportunity stakeholders.</p>
              </div>
            ) : selectedMessages.length === 0 ? (
              <div className="m-auto max-w-xs text-center">
                <p className="text-sm font-medium text-slate-700">No messages yet.</p>
                <p className="mt-1 text-xs text-slate-500">Send the first message in this thread.</p>
              </div>
            ) : (
              selectedMessages.map((chatMessage) => {
                const isMine = currentUserEmail && chatMessage.sender.email.toLowerCase() === currentUserEmail.toLowerCase();
                return (
                  <div key={chatMessage.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed ${
                        isMine
                          ? "rounded-br-md bg-slate-900 text-white"
                          : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {chatMessage.body}
                    </div>
                    <p className="mt-1 px-1 text-[11px] text-slate-400">
                      {isMine ? "You" : chatMessage.sender.fullName} · {formatTimestamp(chatMessage.createdAt)}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-200 bg-white px-4 py-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-2">
              {!selectedThread && (
                <div className="flex items-center gap-2 border-b border-slate-200 px-2 pb-2">
                  <span className="w-10 text-xs text-slate-400">To</span>
                  <select
                    multiple
                    value={newThreadParticipantIds.map(String)}
                    onChange={(event) =>
                      setNewThreadParticipantIds(Array.from(event.target.selectedOptions, (option) => Number(option.value)))
                    }
                    className="min-h-20 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                  >
                    {availableNewThreadParticipants.map((participant) => (
                      <option key={participant.userId} value={participant.userId}>
                        {formatParticipantLabel(participant)} - {formatParticipantSubtitle(participant)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={2}
                placeholder={selectedThread ? "Type a message..." : "Type the first message for the new thread..."}
                className="max-h-32 min-h-[3rem] w-full resize-none bg-transparent px-2 py-1 text-sm text-slate-700 outline-none placeholder:text-slate-400"
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
              <div className="flex items-center justify-between px-2 pb-1 pt-2">
                <p className="text-[11px] text-slate-400">
                  {selectedThread
                    ? "Any participant can add opportunity-defined stakeholders."
                    : "Pick opportunity-defined stakeholders to start a new thread."}
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
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-xl shadow-slate-900/10 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-2xl md:bottom-6 md:right-6"
        >
          <span className="material-symbols-outlined text-[18px] text-slate-600">chat</span>
          Chat
        </button>
      )}
    </>
  );
}
