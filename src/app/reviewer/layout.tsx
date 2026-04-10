import { requireSession } from "@/lib/session";
import { AppHeader } from "@/components/layouts/AppHeader";
import { Sidebar } from "@/components/layouts/Sidebar";
import { redirect } from "next/navigation";

export default function ReviewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = requireSession();

  if (session.role !== "REVIEWER") {
    redirect("/select-workspace");
  }

  const navItems = [
    { href: "/reviewer", icon: "inbox", label: "Task Inbox" },
    { href: "/reviewer/messages", icon: "chat", label: "Messages" },
  ];

  return (
    <div className="min-h-screen bg-background-light">
      <AppHeader
        userName={session.name}
        roleDisplayName={session.roleDisplayName}
        canSwitchWorkspace={(session.availableWorkspaces?.length || 0) > 1}
      />
      <Sidebar items={navItems} />
      <main className="pl-64 pt-16 min-h-screen">
        <div className="p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
