"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";

type NotificationEvent = {
  id: number;
  application_id: number | null;
  event_type: string;
  recipient_email: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
};

type OutboxItem = {
  id: number;
  recipient_email: string;
  subject: string;
  provider: string;
  status: string;
  attempts: number;
  created_at: string;
};

type EscalationPolicy = {
  id: number;
  reminder_before_hours: number;
  escalate_after_hours: number;
  escalate_to_email: string;
  is_active: number;
};

type OperationsPayload = {
  notifications: Record<string, number>;
  emailOutbox: Record<string, number>;
  reminders: Record<string, number>;
  dueReminderCount: number;
  recentNotifications: NotificationEvent[];
  pendingOutbox: OutboxItem[];
  escalationPolicies: EscalationPolicy[];
  emailProvider: {
    mode: string;
    provider: string;
    ready: boolean;
    host: string;
    port: number;
    from_email: string;
    from_name: string;
    reply_to: string;
    requiredEnv: string[];
  };
  sso: { status: string; provider: string | null; linkedIdentityCount: number };
};

function countOf(values: Record<string, number> | undefined, key: string) {
  return values?.[key] ?? 0;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminOperationsPage() {
  const [data, setData] = useState<OperationsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [testEmail, setTestEmail] = useState("adf401919@gmail.com");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/admin/operations");
    const payload = await response.json();
    setData(payload);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  async function runReminders() {
    setRunning(true);
    try {
      await fetch("/api/admin/reminders/run", { method: "POST" });
      await load();
    } finally {
      setRunning(false);
    }
  }

  async function sendTestEmail() {
    setSendingTest(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/admin/sla-reminders/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: testEmail }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || "Unable to send test email.");
      }
      setTestResult(payload.dry_run ? `Dry run recorded for ${payload.to_email}. Add Brevo SMTP credentials for live delivery.` : `Live email sent to ${payload.to_email} via ${payload.provider}.`);
      await load();
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : "Unable to send test email.");
    } finally {
      setSendingTest(false);
    }
  }

  const notificationColumns = [
    {
      key: "title",
      header: "Event",
      cell: (item: NotificationEvent) => (
        <div>
          <p className="font-bold text-slate-900">{item.title}</p>
          <p className="text-xs text-slate-500">{item.event_type}</p>
        </div>
      ),
    },
    {
      key: "recipient",
      header: "Recipient",
      cell: (item: NotificationEvent) => <span className="text-sm text-slate-600">{item.recipient_email}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (item: NotificationEvent) => (
        <Badge variant={item.priority === "high" ? "danger" : item.status === "read" ? "success" : "info"}>
          {item.status}
        </Badge>
      ),
    },
    {
      key: "created",
      header: "Created",
      cell: (item: NotificationEvent) => <span className="text-xs text-slate-500">{formatDate(item.created_at)}</span>,
    },
  ];

  const outboxColumns = [
    {
      key: "subject",
      header: "Message",
      cell: (item: OutboxItem) => (
        <div>
          <p className="font-bold text-slate-900">{item.subject}</p>
          <p className="text-xs text-slate-500">{item.recipient_email}</p>
        </div>
      ),
    },
    {
      key: "provider",
      header: "Provider",
      cell: (item: OutboxItem) => <span className="font-mono text-xs text-slate-500">{item.provider}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (item: OutboxItem) => <Badge variant={item.status === "sent" ? "success" : "warning"}>{item.status}</Badge>,
    },
    {
      key: "attempts",
      header: "Attempts",
      cell: (item: OutboxItem) => <span className="text-sm text-slate-600">{item.attempts}</span>,
    },
  ];

  const activePolicy = data?.escalationPolicies?.find((policy) => policy.is_active) || data?.escalationPolicies?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Operations</h1>
          <p className="mt-2 text-slate-500">Notifications, email outbox, reminders, escalation, and identity readiness.</p>
        </div>
        <Button icon="notifications_active" loading={running} onClick={runReminders}>
          Run Reminders
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-slate-900 text-white border-slate-800">
          <span className="text-sm font-bold uppercase tracking-wider text-slate-400">Queued Notifications</span>
          <p className="mt-2 text-4xl font-black">{loading ? "-" : countOf(data?.notifications, "queued")}</p>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/10">
          <span className="text-sm font-bold uppercase tracking-wider text-amber-800">Email Outbox</span>
          <p className="mt-2 text-4xl font-black text-amber-900">{loading ? "-" : countOf(data?.emailOutbox, "queued")}</p>
        </Card>
        <Card className="border-indigo-500/20 bg-indigo-500/10">
          <span className="text-sm font-bold uppercase tracking-wider text-indigo-800">Due Reminders</span>
          <p className="mt-2 text-4xl font-black text-indigo-900">{loading ? "-" : data?.dueReminderCount ?? 0}</p>
        </Card>
        <Card className="border-green-500/20 bg-green-500/10">
          <span className="text-sm font-bold uppercase tracking-wider text-green-800">SSO Links</span>
          <p className="mt-2 text-4xl font-black text-green-900">{loading ? "-" : data?.sso.linkedIdentityCount ?? 0}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2 p-0">
          <div className="border-b border-slate-100 p-6">
            <CardHeader title="Recent Notification Events" subtitle="Durable events queued by workflow actions." className="mb-0" />
          </div>
          <div className="px-2 pb-2">
            <Table
              data={data?.recentNotifications || []}
              columns={notificationColumns}
              keyExtractor={(item: NotificationEvent) => item.id}
              emptyMessage={loading ? "Loading notification events..." : "No notification events queued yet."}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Delivery Readiness" />
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">Email mode</span>
                <Badge variant={data?.emailProvider.ready ? "success" : "warning"}>{data?.emailProvider.mode || "outbox"}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {data?.emailProvider.ready
                  ? `Brevo SMTP is ready from ${data.emailProvider.from_name} <${data.emailProvider.from_email}>.`
                  : `Brevo SMTP credentials are missing: ${(data?.emailProvider.requiredEnv || []).join(", ") || "none"}.`}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Host: {data?.emailProvider.host || "smtp-relay.brevo.com"}:{data?.emailProvider.port || 587} · Reply-To: {data?.emailProvider.reply_to || "not set"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="font-bold text-slate-900">Send Test Email</p>
              <div className="mt-3 flex flex-col gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(event) => setTestEmail(event.target.value)}
                  className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-primary"
                  placeholder="recipient@example.com"
                />
                <Button icon="send" loading={sendingTest} onClick={sendTestEmail}>
                  Send Test
                </Button>
              </div>
              {testResult && <p className="mt-3 text-sm text-slate-600">{testResult}</p>}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">SSO status</span>
                <Badge variant={data?.sso.status === "configured" ? "success" : "info"}>{data?.sso.status || "not_configured"}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-500">Provider: {data?.sso.provider || "environment not set"}</p>
            </div>
            {activePolicy && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="font-bold text-slate-900">Escalation Policy</p>
                <p className="mt-2 text-sm text-slate-500">
                  Reminder {activePolicy.reminder_before_hours}h before SLA, escalation to {activePolicy.escalate_to_email}.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-0">
        <div className="border-b border-slate-100 p-6">
          <CardHeader title="Email Outbox" subtitle="Provider-neutral messages retained before delivery." className="mb-0" />
        </div>
        <div className="px-2 pb-2">
          <Table
            data={data?.pendingOutbox || []}
            columns={outboxColumns}
            keyExtractor={(item: OutboxItem) => item.id}
            emptyMessage={loading ? "Loading email outbox..." : "No email outbox records yet."}
          />
        </div>
      </Card>
    </div>
  );
}
