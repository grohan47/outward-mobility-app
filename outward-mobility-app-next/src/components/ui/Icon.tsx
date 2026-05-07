type IconProps = {
  name: string;
  className?: string;
  title?: string;
};

export function Icon({ name, className = "h-5 w-5", title }: IconProps) {
  const props = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    role: title ? "img" : undefined,
    "aria-hidden": title ? undefined : true,
  };

  const label = title ? <title>{title}</title> : null;

  switch (name) {
    case "add":
      return <svg {...props}>{label}<path d="M12 5v14" /><path d="M5 12h14" /></svg>;
    case "remove":
      return <svg {...props}>{label}<path d="M5 12h14" /></svg>;
    case "arrow_back":
      return <svg {...props}>{label}<path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>;
    case "arrow_forward":
      return <svg {...props}>{label}<path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>;
    case "undo":
      return <svg {...props}>{label}<path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-1" /></svg>;
    case "redo":
      return <svg {...props}>{label}<path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h1" /></svg>;
    case "fit_screen":
      return <svg {...props}>{label}<path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" /><path d="M8 21H5a2 2 0 0 1-2-2v-3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /><rect x="8" y="8" width="8" height="8" rx="1.5" /></svg>;
    case "auto_fix_high":
      return <svg {...props}>{label}<path d="m14 4 1 3 3 1-3 1-1 3-1-3-3-1 3-1z" /><path d="m6 14 .8 2.2L9 17l-2.2.8L6 20l-.8-2.2L3 17l2.2-.8z" /><path d="m19 15 .6 1.4L21 17l-1.4.6L19 19l-.6-1.4L17 17l1.4-.6z" /></svg>;
    case "person_add":
      return <svg {...props}>{label}<circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M18 8v6" /><path d="M15 11h6" /></svg>;
    case "verified":
      return <svg {...props}>{label}<path d="M12 3 9.8 5.1 6.8 4.7 6.2 7.7 3.5 9.2 5 12l-1.5 2.8 2.7 1.5.6 3 3-.4L12 21l2.2-2.1 3 .4.6-3 2.7-1.5L19 12l1.5-2.8-2.7-1.5-.6-3-3 .4z" /><path d="m8.8 12 2.1 2.1 4.3-4.5" /></svg>;
    case "rule":
      return <svg {...props}>{label}<path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /><path d="m8 9 2 2 3-4" /><path d="m8 15 2 2 3-4" /></svg>;
    case "call_split":
      return <svg {...props}>{label}<path d="M12 21v-6" /><path d="M12 15 6 9" /><path d="M12 15l6-6" /><path d="M6 9V3" /><path d="m3 6 3-3 3 3" /><path d="M18 9V3" /><path d="m15 6 3-3 3 3" /></svg>;
    case "merge_type":
      return <svg {...props}>{label}<path d="M7 3v5a4 4 0 0 0 4 4h2a4 4 0 0 1 4 4v5" /><path d="M17 3v5a4 4 0 0 1-4 4h-2a4 4 0 0 0-4 4v5" /></svg>;
    case "block":
      return <svg {...props}>{label}<circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></svg>;
    case "link":
      return <svg {...props}>{label}<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1" /></svg>;
    case "description":
      return <svg {...props}>{label}<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h4" /></svg>;
    case "chat":
      return <svg {...props}>{label}<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /><path d="M8 9h8" /><path d="M8 13h5" /></svg>;
    case "inbox":
      return <svg {...props}>{label}<path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="m5.5 5-3.3 7.2A2 2 0 0 0 4 15h16a2 2 0 0 0 1.8-2.8L18.5 5A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1z" /></svg>;
    case "public":
      return <svg {...props}>{label}<circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18" /><path d="M12 3a14 14 0 0 0 0 18" /></svg>;
    case "explore_off":
      return <svg {...props}>{label}<circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z" /><path d="m4 4 16 16" /></svg>;
    case "swap_horiz":
      return <svg {...props}>{label}<path d="M7 7h13" /><path d="m17 4 3 3-3 3" /><path d="M17 17H4" /><path d="m7 14-3 3 3 3" /></svg>;
    case "logout":
      return <svg {...props}>{label}<path d="M10 17 15 12l-5-5" /><path d="M15 12H3" /><path d="M21 5v14a2 2 0 0 1-2 2h-6" /><path d="M13 3h6a2 2 0 0 1 2 2" /></svg>;
    case "error":
      return <svg {...props}>{label}<circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 16h.01" /></svg>;
    case "login":
      return <svg {...props}>{label}<path d="M14 7 19 12l-5 5" /><path d="M19 12H7" /><path d="M3 5v14a2 2 0 0 0 2 2h6" /><path d="M11 3H5a2 2 0 0 0-2 2" /></svg>;
    case "send":
      return <svg {...props}>{label}<path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></svg>;
    case "search":
      return <svg {...props}>{label}<circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
    case "explore":
      return <svg {...props}>{label}<circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z" /></svg>;
    case "pending_actions":
      return <svg {...props}>{label}<path d="M8 3h8" /><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 11h4" /><path d="M9 15h3" /><circle cx="17" cy="17" r="4" /><path d="M17 15v2l1.5 1" /></svg>;
    case "task_alt":
      return <svg {...props}>{label}<circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></svg>;
    case "info":
      return <svg {...props}>{label}<circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></svg>;
    case "schedule":
      return <svg {...props}>{label}<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "visibility_off":
      return <svg {...props}>{label}<path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c5.5 0 9 5 9 8a8.4 8.4 0 0 1-2.1 3.9" /><path d="M6.4 6.5C4.3 7.9 3 10 3 12c0 3 3.5 8 9 8a10.8 10.8 0 0 0 4-.8" /></svg>;
    case "event":
      return <svg {...props}>{label}<rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M3 10h18" /></svg>;
    case "delete":
      return <svg {...props}>{label}<path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 14H6L5 6" /><path d="M10 11v5" /><path d="M14 11v5" /></svg>;
    case "close":
      return <svg {...props}>{label}<path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>;
    case "auto_awesome":
      return <svg {...props}>{label}<path d="M12 2.5 13.8 8 19 10l-5.2 2L12 17.5 10.2 12 5 10l5.2-2z" /><path d="m5 15 .8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8z" /><path d="m18 4 .7 1.8L20.5 6.5l-1.8.7L18 9l-.7-1.8-1.8-.7 1.8-.7z" /></svg>;
    case "touch_app":
      return <svg {...props}>{label}<path d="M9 11V5a2 2 0 0 1 4 0v6" /><path d="M13 9a2 2 0 0 1 4 0v3" /><path d="M17 11a2 2 0 0 1 4 0v2" /><path d="M9 12 7.3 10.3a2 2 0 0 0-2.8 2.8l5.2 5.2A6 6 0 0 0 14 20h1a6 6 0 0 0 6-6v-2" /></svg>;
    case "warning":
      return <svg {...props}>{label}<path d="m12 3 10 18H2z" /><path d="M12 9v5" /><path d="M12 17h.01" /></svg>;
    case "help":
      return <svg {...props}>{label}<circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.7 2.7 0 0 1 5.1 1.3c0 1.8-2.6 2.2-2.6 4" /><path d="M12 17h.01" /></svg>;
    case "radio_button_checked":
      return <svg {...props}>{label}<circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /></svg>;
    case "account_tree":
      return <svg {...props}>{label}<rect x="9" y="3" width="6" height="5" rx="1.5" /><rect x="3" y="16" width="6" height="5" rx="1.5" /><rect x="15" y="16" width="6" height="5" rx="1.5" /><path d="M12 8v4" /><path d="M6 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" /></svg>;
    case "publish":
      return <svg {...props}>{label}<path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 16v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" /></svg>;
    case "progress_activity":
      return <svg {...props}>{label}<path d="M21 12a9 9 0 0 1-9 9" /><path d="M3 12a9 9 0 0 1 9-9" /></svg>;
    case "check_circle":
      return <svg {...props}>{label}<circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></svg>;
    case "radio_button_unchecked":
      return <svg {...props}>{label}<circle cx="12" cy="12" r="8" /></svg>;
    default:
      return <svg {...props}>{label}<circle cx="12" cy="12" r="8" /><path d="M12 8v8" /><path d="M8 12h8" /></svg>;
  }
}
