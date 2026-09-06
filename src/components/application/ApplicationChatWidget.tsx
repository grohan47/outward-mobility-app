"use client";

import { useEffect, useRef, useState } from "react";
import {
  labelForVisibility,
  STAFF_AUDIENCES,
  STUDENT_AUDIENCES,
  type CommentVisibility,
} from "@/components/application/chatStakeholders";

type CommentRecord = {
  id: number;
  author_email: string;
  text: string;
  visibility: string;
  created_at: string;
};

type SessionPayload = {
  user?: {
    email?: string;
  };
};

interface ApplicationChatWidgetProps {
  applicationId: number;
  contextLabel: string;
  visible?: boolean;
  audience?: "staff" | "student";
}

function formatAuthorLabel(authorEmail: string, currentUserEmail: string | null): string {
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

export function ApplicationChatWidget({
  applicationId,
  contextLabel,
  visible = true,
  audience = "staff",
}: ApplicationChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<CommentVisibility>(
    audience === "student" ? "student_visible" : "internal",
  );
  const listRef = useRef<HTMLDivElement | null>(null);
  const audienceOptions = audience === "student" ? STUDENT_AUDIENCES : STAFF_AUDIENCES;

  useEffect(() => {
    // Frontend -> API: GET /api/auth/me
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: SessionPayload | null) => {
        setCurrentUserEmail(payload?.user?.email?.toLowerCase() || null);
      })
      .catch(() => {
        setCurrentUserEmail(null);
      });
  }, []);

  async function openChat() {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      // Frontend -> API: GET /api/applications/:id/comments
      const response = await fetch(`/api/applications/${applicationId}/comments`);
      const payload: { comments?: CommentRecord[]; detail?: string } = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Unable to load chat.");
      setComments(Array.isArray(payload.comments) ? payload.comments : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load chat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [comments, open]);

  async function handleSubmit() {
    const trimmed = message.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);

    try {
      // Frontend -> API: POST /api/applications/:id/comments
      const response = await fetch(`/api/applications/${applicationId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: trimmed,
          visibility,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || "Unable to send message.");
      }

      if (payload?.comment) {
        setComments((current) => [...current, payload.comment as CommentRecord]);
      }
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!visible) return null;

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 md:right-6">
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

          <div
            ref={listRef}
            className="flex max-h-[24rem] min-h-[18rem] flex-col gap-3 overflow-y-auto bg-slate-50/80 px-4 py-4"
          >
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            ) : comments.length === 0 ? (
              <div className="m-auto max-w-xs text-center">
                <p className="text-sm font-medium text-slate-700">No messages yet.</p>
                <p className="mt-1 text-xs text-slate-500">
                  Use this space for application-specific communication.
                </p>
              </div>
            ) : (
              comments.map((comment) => {
                const isMine =
                  currentUserEmail && comment.author_email.toLowerCase() === currentUserEmail.toLowerCase();
                const audienceLabel = labelForVisibility(comment.visibility);

                return (
                  <div
                    key={comment.id}
                    className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed ${
                        isMine
                          ? "rounded-br-md bg-slate-900 text-white"
                          : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {comment.text}
                    </div>
                    <p className="mt-1 flex items-center gap-2 px-1 text-[11px] text-slate-400">
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {audienceLabel}
                      </span>
                      <span>
                      {formatAuthorLabel(comment.author_email, currentUserEmail)} ·{" "}
                      {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-200 bg-white px-4 py-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-2">
              <div className="flex items-center gap-2 border-b border-slate-200 px-2 pb-2">
                <span className="w-10 text-xs text-slate-400">To</span>
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as CommentVisibility)}
                  disabled={audienceOptions.length === 1}
                  className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                >
                  {audienceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={2}
                placeholder="Type a message..."
                className="max-h-32 min-h-[3rem] w-full resize-none bg-transparent px-2 py-1 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSubmit();
                  }
                }}
              />
              <div className="flex items-center justify-between px-2 pb-1 pt-2">
                <p className="text-[11px] text-slate-400">Enter to send</p>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
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
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => void openChat()}
          className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-xl shadow-slate-900/10 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-2xl md:bottom-6 md:right-6"
        >
          <span className="material-symbols-outlined text-[18px] text-slate-600">chat</span>
          Chat
        </button>
      )}
    </>
  );
}
