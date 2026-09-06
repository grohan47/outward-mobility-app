import { requireSession } from "@/lib/session";
import { AppHeader } from "@/components/layouts/AppHeader";
import { Sidebar } from "@/components/layouts/Sidebar";
import { redirect } from "next/navigation";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  if (session.role !== "STUDENT") {
    redirect("/select-workspace");
  }

  const navItems = [
    { href: "/student", icon: "dashboard", label: "Dashboard" },
    { href: "/student/opportunities", icon: "explore", label: "Opportunities" },
    { href: "/student/applications", icon: "description", label: "My Applications" },
    { href: "/student/messages", icon: "chat", label: "Messages" },
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
