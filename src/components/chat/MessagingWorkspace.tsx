"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type SessionUser = {
  userId: number;
  name: string;
  email: string;
  role: string;
  roleDisplayName: string;
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

type ChatThreadSummary = {
  id: number;
  participants: ChatParticipant[];
  participantCount: number;
  messageCount: number;
  lastMessage: ChatMessage | null;
};

type ChatApplicationSummary = {
  id: number;
  opportunityId: number;
  opportunityTitle: string;
  opportunityTerm: string | null;
  opportunityDestination: string | null;
  currentStepOrder: number;
  currentStage: string;
  finalStatus: string | null;
  updatedAt: string;
  studentId: string;
  applicant: {
    userId: number;
    fullName: string;
    email: string;
  };
};

type InboxItem = {
  applicationId: number;
  opportunityTitle: string;
  opportunityTerm: string | null;
  opportunityDestination: string | null;
  currentStage: string;
  finalStatus: string | null;
  updatedAt: string;
  studentId: string;
  applicant: {
    userId: number;
    fullName: string;
    email: string;
  };
  visibleThreadCount: number;
  lastMessage: ChatMessage | null;
};

type ApplicationChatData = {
  application: ChatApplicationSummary;
  eligibleParticipants: ChatParticipant[];
  threads: ChatThreadSummary[];
  canAddExternalStakeholder: boolean;
};

type ThreadChatData = {
  application: ChatApplicationSummary;
  thread: ChatThreadSummary;
  messages: ChatMessage[];
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "No activity yet";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function participantTitle(participants: ChatParticipant[], currentUserId?: number) {
  const others = participants.filter((participant) => participant.userId !== currentUserId);
  if (others.length === 0) {
    return participants.map((participant) => participant.fullName).join(", ");
  }
  return others.map((participant) => participant.fullName).join(", ");
}

function participantContext(participant: ChatParticipant) {
  if (participant.contextLabels.length === 0) return participant.kind;
  return participant.contextLabels.join(", ");
}

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map<number, ChatMessage>();
  for (const message of existing) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return Array.from(byId.values()).sort((left, right) => left.id - right.id);
}

export function MessagingWorkspace({ workspaceLabel }: { workspaceLabel: string }) {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingApplication, setLoadingApplication] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [applicationData, setApplicationData] = useState<ApplicationChatData | null>(null);
  const [threadData, setThreadData] = useState<ThreadChatData | null>(null);

  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);

  const [showNewThreadForm, setShowNewThreadForm] = useState(false);
  const [showThreadParticipantPicker, setShowThreadParticipantPicker] = useState(false);
  const [showAddParticipantForm, setShowAddParticipantForm] = useState(false);
  const [showAddParticipantPicker, setShowAddParticipantPicker] = useState(false);

  const [newThreadParticipantIds, setNewThreadParticipantIds] = useState<number[]>([]);
  const [newThreadMessage, setNewThreadMessage] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [addParticipantIds, setAddParticipantIds] = useState<number[]>([]);

  const [submittingThread, setSubmittingThread] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [addingParticipants, setAddingParticipants] = useState(false);

  const currentUserId = session?.userId ?? null;

  async function loadInbox() {
    const response = await fetch("/api/chat/inbox");
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body?.detail || "Unable to load your chat inbox.");
    }
    const items: InboxItem[] = body.items || [];
    setInboxItems(items);
    setSelectedApplicationId((current) => {
      if (items.length === 0) return null;
      if (current && items.some((item) => item.applicationId === current)) return current;
      return items[0].applicationId;
    });
  }

  async function loadApplication(applicationId: number) {
    setLoadingApplication(true);
    try {
      const response = await fetch(`/api/chat/applications/${applicationId}`);
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.detail || "Unable to load application chat threads.");
      }
      const nextData: ApplicationChatData = body;
      setApplicationData(nextData);
      setSelectedThreadId((current) => {
        if (current && nextData.threads.some((thread) => thread.id === current)) return current;
        return nextData.threads[0]?.id ?? null;
      });
    } finally {
      setLoadingApplication(false);
    }
  }

  async function loadThread(threadId: number, incremental = false) {
    setLoadingThread(!incremental);
    try {
      const lastMessageId = incremental ? threadData?.messages.at(-1)?.id ?? null : null;
      const search = lastMessageId ? `?afterMessageId=${lastMessageId}` : "";
      const response = await fetch(`/api/chat/threads/${threadId}${search}`);
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.detail || "Unable to load thread messages.");
      }
      const nextMessages = incremental ? mergeMessages(threadData?.messages || [], body.messages || []) : (body.messages || []);
      setThreadData({
        application: body.application,
        thread: body.thread,
        messages: nextMessages,
      });
    } finally {
      setLoadingThread(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const [sessionResponse, inboxResponse] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/chat/inbox"),
        ]);
        const [sessionBody, inboxBody] = await Promise.all([
          sessionResponse.json(),
          inboxResponse.json(),
        ]);
        if (!sessionResponse.ok) {
          throw new Error(sessionBody?.detail || "Unable to load the current session.");
        }
        if (!inboxResponse.ok) {
          throw new Error(inboxBody?.detail || "Unable to load your chat inbox.");
        }
        if (!active) return;
        setSession(sessionBody.user || null);
        const items: InboxItem[] = inboxBody.items || [];
        setInboxItems(items);
        setSelectedApplicationId(items[0]?.applicationId ?? null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load messaging right now.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedApplicationId) {
      setApplicationData(null);
      setSelectedThreadId(null);
      setThreadData(null);
      return;
    }

    void loadApplication(selectedApplicationId).catch((err) => {
      setError(err instanceof Error ? err.message : "Unable to load the selected application.");
    });
  }, [selectedApplicationId]);

  useEffect(() => {
    if (!selectedThreadId) {
      setThreadData(null);
      return;
    }

    void loadThread(selectedThreadId).catch((err) => {
      setError(err instanceof Error ? err.message : "Unable to load the selected thread.");
    });
  }, [selectedThreadId]);

  useEffect(() => {
    if (loading) return;
    const interval = window.setInterval(() => {
      void loadInbox().catch(() => {});
    }, 25000);
    return () => window.clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!selectedApplicationId) return;
    const interval = window.setInterval(() => {
      void loadApplication(selectedApplicationId).catch(() => {});
    }, 15000);
    return () => window.clearInterval(interval);
  }, [selectedApplicationId]);

  useEffect(() => {
    if (!selectedThreadId) return;
    const interval = window.setInterval(() => {
      void loadThread(selectedThreadId, true).catch(() => {});
    }, 6000);
    return () => window.clearInterval(interval);
  }, [selectedThreadId, threadData]);

  const newThreadOptions = useMemo(() => {
    if (!applicationData) return [];
    return applicationData.eligibleParticipants.filter((participant) => participant.userId !== currentUserId);
  }, [applicationData, currentUserId]);

  const addParticipantOptions = useMemo(() => {
    if (!applicationData || !threadData) return [];
    const existing = new Set(threadData.thread.participants.map((participant) => participant.userId));
    return applicationData.eligibleParticipants.filter((participant) => !existing.has(participant.userId));
  }, [applicationData, threadData]);

  const threadCount = applicationData?.threads.length || 0;
  const currentThreadTitle = threadData ? participantTitle(threadData.thread.participants, currentUserId ?? undefined) : "";

  function toggleSelection(target: number, values: number[], setValues: (next: number[]) => void) {
    if (values.includes(target)) {
      setValues(values.filter((value) => value !== target));
      return;
    }
    setValues([...values, target]);
  }

  async function handleCreateThread() {
    if (!selectedApplicationId) return;
    if (!newThreadMessage.trim()) {
      setError("Add the first message before creating the thread.");
      return;
    }
    if (newThreadParticipantIds.length === 0) {
      setError("Choose at least one stakeholder for the thread.");
      return;
    }

    setSubmittingThread(true);
    setError(null);
    try {
      const response = await fetch(`/api/chat/applications/${selectedApplicationId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantUserIds: newThreadParticipantIds,
          initialMessage: newThreadMessage.trim(),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.detail || "Unable to create the chat thread.");
      }

      setShowNewThreadForm(false);
      setShowThreadParticipantPicker(false);
      setNewThreadParticipantIds([]);
      setNewThreadMessage("");

      await loadInbox();
      await loadApplication(selectedApplicationId);
      setSelectedThreadId(body.thread?.id || null);
      setThreadData({
        application: body.application,
        thread: body.thread,
        messages: body.messages || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create the chat thread.");
    } finally {
      setSubmittingThread(false);
    }
  }

  async function handleSendMessage() {
    if (!selectedThreadId || !draftMessage.trim()) return;

    setSendingMessage(true);
    setError(null);
    try {
      const response = await fetch(`/api/chat/threads/${selectedThreadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draftMessage.trim() }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.detail || "Unable to send the message.");
      }

      setDraftMessage("");
      setThreadData((current) => {
        if (!current || !body.message) return current;
        return {
          ...current,
          thread: body.thread,
          messages: mergeMessages(current.messages, [body.message]),
        };
      });
      if (selectedApplicationId) {
        await loadInbox();
        await loadApplication(selectedApplicationId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send the message.");
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleAddParticipants() {
    if (!selectedThreadId || addParticipantIds.length === 0) {
      setError("Choose at least one participant to add.");
      return;
    }

    setAddingParticipants(true);
    setError(null);
    try {
      const response = await fetch(`/api/chat/threads/${selectedThreadId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantUserIds: addParticipantIds }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.detail || "Unable to add participants.");
      }

      setShowAddParticipantForm(false);
      setShowAddParticipantPicker(false);
      setAddParticipantIds([]);

      if (selectedApplicationId) {
        await loadApplication(selectedApplicationId);
      }
      await loadThread(selectedThreadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add participants.");
    } finally {
      setAddingParticipants(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center text-slate-400">
        <span className="material-symbols-outlined animate-spin text-4xl mb-4">progress_activity</span>
        <p>Loading messaging...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Messaging</h1>
          <p className="text-slate-500 mt-2">
            {workspaceLabel} workspace conversations grouped by application. Each thread is visible only to the selected participants.
          </p>
        </div>
        <div className="flex gap-3">
          <Card className="min-w-[170px]">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400">Applications</p>
            <p className="mt-3 text-3xl font-black text-slate-900">{inboxItems.length}</p>
          </Card>
          <Card className="min-w-[170px]">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400">Visible Threads</p>
            <p className="mt-3 text-3xl font-black text-slate-900">
              {inboxItems.reduce((total, item) => total + item.visibleThreadCount, 0)}
            </p>
          </Card>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[320px_360px_minmax(0,1fr)] gap-6">
        <Card noPadding className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">Applications</h2>
            <p className="text-sm text-slate-500 mt-1">Open an application to view or start chat threads.</p>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {inboxItems.length === 0 ? (
              <div className="px-5 py-8 text-sm text-slate-500">No chat-enabled applications are available in this workspace yet.</div>
            ) : (
              inboxItems.map((item) => {
                const isActive = item.applicationId === selectedApplicationId;
                return (
                  <button
                    key={item.applicationId}
                    type="button"
                    onClick={() => {
                      setSelectedApplicationId(item.applicationId);
                      setError(null);
                    }}
                    className={`w-full border-b border-slate-100 px-5 py-4 text-left transition-colors ${
                      isActive ? "bg-primary/5" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.opportunityTitle}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {item.applicant.fullName} · {item.studentId}
                        </p>
                      </div>
                      <Badge variant="neutral">{item.visibleThreadCount} thread{item.visibleThreadCount === 1 ? "" : "s"}</Badge>
                    </div>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{item.currentStage}</p>
                    <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                      {item.lastMessage?.body || "No visible threads yet. Start the first conversation for this application."}
                    </p>
                    <p className="mt-3 text-[11px] font-semibold text-slate-400">{formatDateTime(item.lastMessage?.createdAt || item.updatedAt)}</p>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <Card noPadding className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Threads</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {applicationData
                    ? `Application #${applicationData.application.id} · ${applicationData.application.currentStage}`
                    : "Pick an application to manage its threads."}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon="add_comment"
                disabled={!applicationData}
                onClick={() => {
                  setShowNewThreadForm((current) => !current);
                  setError(null);
                }}
              >
                New Thread
              </Button>
            </div>
          </div>

          {showNewThreadForm && applicationData && (
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700">Selected stakeholders</p>
                <Button variant="outline" size="sm" disabled>
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Outside Workflow Soon
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {newThreadParticipantIds.length === 0 ? (
                  <span className="text-sm text-slate-500">No stakeholders selected yet.</span>
                ) : (
                  newThreadOptions
                    .filter((participant) => newThreadParticipantIds.includes(participant.userId))
                    .map((participant) => (
                      <Badge key={participant.userId} variant="info">
                        {participant.fullName}
                      </Badge>
                    ))
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowThreadParticipantPicker((current) => !current)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700"
                >
                  <span>Select stakeholders from this application</span>
                  <span className="material-symbols-outlined text-slate-400">
                    {showThreadParticipantPicker ? "expand_less" : "expand_more"}
                  </span>
                </button>
                {showThreadParticipantPicker && (
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    {newThreadOptions.map((participant) => (
                      <label
                        key={participant.userId}
                        className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={newThreadParticipantIds.includes(participant.userId)}
                          onChange={() => toggleSelection(participant.userId, newThreadParticipantIds, setNewThreadParticipantIds)}
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{participant.fullName}</p>
                          <p className="text-xs text-slate-500">{participant.email}</p>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.18em] mt-1">
                            {participantContext(participant)}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 mb-2">
                  First Message
                </label>
                <textarea
                  rows={4}
                  value={newThreadMessage}
                  onChange={(event) => setNewThreadMessage(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  placeholder="Start the thread with the context or question you want to discuss."
                />
              </div>

              <div className="flex justify-end">
                <Button loading={submittingThread} onClick={handleCreateThread}>
                  Create Thread
                </Button>
              </div>
            </div>
          )}

          <div className="max-h-[70vh] overflow-y-auto">
            {loadingApplication ? (
              <div className="px-5 py-8 text-sm text-slate-500">Loading threads...</div>
            ) : !applicationData ? (
              <div className="px-5 py-8 text-sm text-slate-500">Choose an application to view its threads.</div>
            ) : threadCount === 0 ? (
              <div className="px-5 py-8 text-sm text-slate-500">
                No visible threads yet for this application. Start one with selected stakeholders above.
              </div>
            ) : (
              applicationData.threads.map((thread) => {
                const isActive = thread.id === selectedThreadId;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => {
                      setSelectedThreadId(thread.id);
                      setError(null);
                    }}
                    className={`w-full border-b border-slate-100 px-5 py-4 text-left transition-colors ${
                      isActive ? "bg-primary/5" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{participantTitle(thread.participants, currentUserId ?? undefined)}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {thread.participantCount} participant{thread.participantCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Badge variant="neutral">{thread.messageCount} msg</Badge>
                    </div>
                    <p className="mt-3 text-sm text-slate-600 line-clamp-2">
                      {thread.lastMessage?.body || "Thread created. No messages yet."}
                    </p>
                    <p className="mt-3 text-[11px] font-semibold text-slate-400">{formatDateTime(thread.lastMessage?.createdAt)}</p>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <Card noPadding className="overflow-hidden">
          {!threadData ? (
            <div className="px-8 py-16 text-center">
              <span className="material-symbols-outlined text-5xl text-slate-300">forum</span>
              <p className="mt-4 text-lg font-bold text-slate-900">Select a thread</p>
              <p className="mt-2 text-sm text-slate-500">
                Open an existing conversation or create a new one for the selected application.
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-100 px-6 py-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Conversation</p>
                    <h2 className="mt-2 text-2xl font-black text-slate-900">{currentThreadTitle}</h2>
                    <p className="mt-2 text-sm text-slate-500">
                      Application #{threadData.application.id} · {threadData.application.opportunityTitle}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="person_add"
                    onClick={() => {
                      setShowAddParticipantForm((current) => !current);
                      setError(null);
                    }}
                  >
                    Add Participants
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {threadData.thread.participants.map((participant) => (
                    <Badge key={participant.userId} variant={participant.kind === "APPLICANT" ? "success" : "info"}>
                      {participant.fullName}
                    </Badge>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Applicant</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{threadData.application.applicant.fullName}</p>
                    <p className="text-xs text-slate-500">{threadData.application.studentId}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Stage</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{threadData.application.currentStage}</p>
                    <p className="text-xs text-slate-500">{threadData.application.finalStatus || "Active"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Context</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{threadData.application.opportunityTitle}</p>
                    <p className="text-xs text-slate-500">
                      {[threadData.application.opportunityTerm, threadData.application.opportunityDestination].filter(Boolean).join(" · ") || "Application thread"}
                    </p>
                  </div>
                </div>

                {showAddParticipantForm && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-700">Add more participants to this thread</p>
                      <Button variant="outline" size="sm" disabled>
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Outside Workflow Soon
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {addParticipantIds.length === 0 ? (
                        <span className="text-sm text-slate-500">No new participants selected yet.</span>
                      ) : (
                        addParticipantOptions
                          .filter((participant) => addParticipantIds.includes(participant.userId))
                          .map((participant) => (
                            <Badge key={participant.userId} variant="info">
                              {participant.fullName}
                            </Badge>
                          ))
                      )}
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowAddParticipantPicker((current) => !current)}
                        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700"
                      >
                        <span>Select additional stakeholders</span>
                        <span className="material-symbols-outlined text-slate-400">
                          {showAddParticipantPicker ? "expand_less" : "expand_more"}
                        </span>
                      </button>
                      {showAddParticipantPicker && (
                        <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                          {addParticipantOptions.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-slate-500">No more eligible stakeholders are available for this thread.</div>
                          ) : (
                            addParticipantOptions.map((participant) => (
                              <label
                                key={participant.userId}
                                className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 hover:bg-slate-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={addParticipantIds.includes(participant.userId)}
                                  onChange={() => toggleSelection(participant.userId, addParticipantIds, setAddParticipantIds)}
                                />
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">{participant.fullName}</p>
                                  <p className="text-xs text-slate-500">{participant.email}</p>
                                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.18em] mt-1">
                                    {participantContext(participant)}
                                  </p>
                                </div>
                              </label>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Button loading={addingParticipants} onClick={handleAddParticipants}>
                        Add to Thread
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="max-h-[48vh] overflow-y-auto bg-slate-50 px-6 py-6 space-y-4">
                {loadingThread && threadData.messages.length === 0 ? (
                  <p className="text-sm text-slate-500">Loading messages...</p>
                ) : threadData.messages.length === 0 ? (
                  <p className="text-sm text-slate-500">No messages in this thread yet.</p>
                ) : (
                  threadData.messages.map((message) => {
                    const mine = message.sender.userId === currentUserId;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                            mine ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-800"
                          }`}
                        >
                          <p className={`text-[11px] font-bold uppercase tracking-[0.2em] ${mine ? "text-white/70" : "text-slate-400"}`}>
                            {mine ? "You" : message.sender.fullName}
                          </p>
                          <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">{message.body}</p>
                          <p className={`mt-3 text-[11px] font-semibold ${mine ? "text-white/70" : "text-slate-400"}`}>
                            {formatDateTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-slate-100 px-6 py-5">
                <label className="block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 mb-2">
                  Reply
                </label>
                <textarea
                  rows={4}
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  placeholder="Write your message here..."
                />
                <div className="mt-4 flex justify-end">
                  <Button icon="send" loading={sendingMessage} onClick={handleSendMessage}>
                    Send Message
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
