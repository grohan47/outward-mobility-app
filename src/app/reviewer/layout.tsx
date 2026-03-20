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

  if (!["REVIEWER", "STUDENT_LIFE", "PROGRAM_CHAIR", "DEAN_ACADEMICS", "OGE_ADMIN"].includes(session.role)) {
    redirect("/");
  }

  const navItems =
    session.role === "OGE_ADMIN"
      ? [
          { href: "/admin", icon: "dashboard", label: "Dashboard" },
          { href: "/admin/applications", icon: "description", label: "Applications" },
          { href: "/admin/opportunities", icon: "star", label: "Opportunities" },
          { href: "/reviewer", icon: "fact_check", label: "Review Panel" },
          { href: "/admin/messages", icon: "chat", label: "Messaging (WIP)" },
        ]
      : [
          { href: "/reviewer", icon: "inbox", label: "Task Inbox" },
          { href: "/reviewer/messages", icon: "chat", label: "Messaging (WIP)" },
        ];

  return (
    <div className="min-h-screen bg-background-light">
      <AppHeader userName={session.name} roleDisplayName={session.roleDisplayName} />
      <Sidebar items={navItems} />
      <main className="pl-64 pt-16 min-h-screen">
        <div className="p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
