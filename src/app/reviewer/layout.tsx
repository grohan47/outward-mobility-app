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

  // Protect route
  if (!["STUDENT_LIFE", "PROGRAM_CHAIR", "DEAN_ACADEMICS", "OGE_ADMIN"].includes(session.role)) {
    redirect("/");
  }

  const navItems = [
    { href: "/reviewer", icon: "inbox", label: "Task Inbox", badge: 4 }, // Hardcoded badge for demo
    { href: "/reviewer/history", icon: "history", label: "Review History" },
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
