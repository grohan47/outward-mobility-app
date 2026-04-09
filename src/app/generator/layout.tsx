import { requireSession } from "@/lib/session";
import { AppHeader } from "@/components/layouts/AppHeader";
import { Sidebar } from "@/components/layouts/Sidebar";
import { redirect } from "next/navigation";

export default function GeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = requireSession();

  if (session.role !== "GENERATOR") {
    redirect("/select-workspace");
  }

  const navItems = [
    { href: "/generator", icon: "dashboard", label: "Dashboard" },
    { href: "/generator/opportunities", icon: "explore", label: "Opportunities" },
    { href: "/generator/applications", icon: "description", label: "My Applications" },
    { href: "/generator/messages", icon: "chat", label: "Messaging" },
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
