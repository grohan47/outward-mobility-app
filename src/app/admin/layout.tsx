import { requireSession } from "@/lib/session";
import { AppHeader } from "@/components/layouts/AppHeader";
import { Sidebar } from "@/components/layouts/Sidebar";
import { redirect } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = requireSession();

  if (session.role !== "OGE_ADMIN") {
    redirect("/");
  }

  const navItems = [
    { href: "/admin", icon: "dashboard", label: "Dashboard" },
    { href: "/admin/applications", icon: "description", label: "Applications" },
    { href: "/admin/opportunities", icon: "star", label: "Opportunities" },
    { href: "/admin/workflows", icon: "account_tree", label: "Workflow Editor" },
    { href: "/admin/settings", icon: "settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-background-light">
      <AppHeader userName={session.name} roleDisplayName={session.roleDisplayName} />
      <Sidebar items={navItems} />
      <main className="pl-64 pt-16 min-h-screen">
        <div className="p-8 max-w-[1600px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
