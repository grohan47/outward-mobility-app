"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  icon: string;
  label: string;
  badge?: number;
}

interface SidebarProps {
  items: NavItem[];
}

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const iconClass = active ? "text-primary" : "text-slate-400";
  const commonProps = {
    className: `h-5 w-5 shrink-0 ${iconClass}`,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...commonProps}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "description":
      return (
        <svg {...commonProps}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </svg>
      );
    case "star":
      return (
        <svg {...commonProps}>
          <path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84-5.4 2.84 1.03-6-4.36-4.25 6.03-.88z" />
        </svg>
      );
    case "explore":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z" />
        </svg>
      );
    case "inbox":
      return (
        <svg {...commonProps}>
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="m5.5 5-3.3 7.2A2 2 0 0 0 4 15h16a2 2 0 0 0 1.8-2.8L18.5 5A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1z" />
        </svg>
      );
    case "chat":
      return (
        <svg {...commonProps}>
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
          <path d="M8 9h8" />
          <path d="M8 13h5" />
        </svg>
      );
    default:
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v8" />
          <path d="M8 12h8" />
        </svg>
      );
  }
}

export function Sidebar({ items }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="fixed top-16 left-0 bottom-0 w-64 bg-slate-50 border-r border-slate-200 p-4 flex flex-col gap-1 overflow-y-auto">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              isActive
                ? "bg-primary/10 text-primary-dark"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <NavIcon name={item.icon} active={isActive} />
              {item.label}
            </div>
            {typeof item.badge !== "undefined" && item.badge > 0 && (
              <span
                className={`flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold ${
                  isActive ? "bg-primary text-white" : "bg-slate-200 text-slate-600"
                }`}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
