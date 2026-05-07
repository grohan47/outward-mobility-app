"use client";

import { useEffect } from "react";

const common = {
  circle: '<circle cx="12" cy="12" r="8" />',
  dot: '<circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />',
  plus: '<path d="M12 5v14M5 12h14" />',
  check: '<path d="m5 12 4 4L19 6" />',
  x: '<path d="M6 6l12 12M18 6 6 18" />',
};

const ICONS: Record<string, string> = {
  account_tree: '<path d="M7 6h4v4H7zM13 14h4v4h-4zM7 18h4v4H7z" /><path d="M9 10v4h6M9 14v4" />',
  add: common.plus,
  arrow_back: '<path d="M19 12H5M12 5l-7 7 7 7" />',
  arrow_forward: '<path d="M5 12h14M12 5l7 7-7 7" />',
  auto_awesome: '<path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6zM5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" />',
  auto_fix_high: '<path d="m14 5 5 5M3 21l7.5-7.5M12 3l1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3z" />',
  block: '<circle cx="12" cy="12" r="8" /><path d="m7 7 10 10" />',
  call_split: '<path d="M12 21v-6c0-3 2-4 5-5M12 15c0-3-2-4-5-5M7 6v4H3M17 6v4h4" />',
  chat: '<path d="M5 6h14v10H8l-3 3z" />',
  check_circle: '<circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" />',
  close: common.x,
  dashboard: '<path d="M4 5h7v6H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 13h7v6H4z" />',
  delete: '<path d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 13h8l1-13" />',
  description: '<path d="M7 3h7l4 4v14H7zM14 3v5h4M9 12h6M9 16h6" />',
  error: '<circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" />',
  event: '<path d="M7 4v3M17 4v3M5 8h14M6 6h12v14H6zM9 12h3M9 16h6" />',
  explore: '<circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z" />',
  explore_off: '<circle cx="12" cy="12" r="9" /><path d="m4 4 16 16M15.5 8.5l-2.2 4.8-4.8 2.2" />',
  fit_screen: '<path d="M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4" />',
  inbox: '<path d="M4 13 7 5h10l3 8v6H4zM4 13h5l1.5 2h3L15 13h5" />',
  info: '<circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" />',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />',
  login: '<path d="M10 17H5V7h5M13 8l4 4-4 4M17 12H8" />',
  logout: '<path d="M14 17h5V7h-5M11 8l-4 4 4 4M7 12h10" />',
  merge_type: '<path d="M7 4v5c0 3 2 4 5 4h5M17 9l4 4-4 4M7 20v-5" />',
  pending_actions: '<path d="M8 4h8M9 4v5l3 3 3-3V4M6 20h12M9 20v-5l3-3 3 3v5" />',
  person_add: '<path d="M15 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M16 11h6" />',
  progress_activity: '<path d="M12 3a9 9 0 1 1-9 9" />',
  public: '<circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9M12 3c-2.5 2.5-3.5 5.5-3.5 9s1 6.5 3.5 9" />',
  publish: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14" />',
  radio_button_unchecked: common.circle,
  redo: '<path d="M20 7v6h-6M20 13a8 8 0 1 0-2.3 5.7" />',
  remove: '<path d="M5 12h14" />',
  rule: '<path d="M4 6h16M4 12h16M4 18h10M8 6v12M16 6v6" />',
  schedule: '<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />',
  search: '<circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" />',
  send: '<path d="m3 11 18-8-8 18-2-8z" />',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2 7.5 14 3 9.6l6.2-.9z" />',
  swap_horiz: '<path d="M7 7h14M17 3l4 4-4 4M17 17H3M7 13l-4 4 4 4" />',
  task_alt: '<circle cx="12" cy="12" r="9" /><path d="m7.5 12 3 3 6-6" />',
  touch_app: '<path d="M9 11V5a2 2 0 1 1 4 0v7M13 12l2-1 2 1 2-1 2 2-2 7h-8l-4-6 2-2 3 3" />',
  undo: '<path d="M4 7v6h6M4 13a8 8 0 1 1 2.3 5.7" />',
  verified: '<path d="m12 2 2.5 2 3.2-.3.8 3.1 2.7 1.7-1.2 3 1.2 3-2.7 1.7-.8 3.1-3.2-.3-2.5 2-2.5-2-3.2.3-.8-3.1-2.7-1.7 1.2-3-1.2-3 2.7-1.7.8-3.1 3.2.3z" /><path d="m8.5 12 2.2 2.2 4.8-5" />',
  visibility_off: '<path d="M3 3l18 18M10.6 10.6A2 2 0 0 0 13.4 13.4M9.9 5.1A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7a13.5 13.5 0 0 1-3.1 4.3M6.3 6.3A13.4 13.4 0 0 0 2.5 12c1 2.5 4.5 7 9.5 7 1.4 0 2.7-.4 3.8-1" />',
  warning: '<path d="M12 3 22 20H2z" /><path d="M12 9v5M12 17h.01" />',
};

function iconSvg(name: string) {
  const paths = ICONS[name] || common.dot;
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
}

function hydrateIcons(root: ParentNode = document) {
  if (root instanceof HTMLElement && root.classList.contains("material-symbols-outlined")) {
    const icon = root.dataset.icon || root.textContent?.trim();
    if (icon && root.dataset.iconHydrated !== icon) {
      root.dataset.icon = icon;
      root.dataset.iconHydrated = icon;
      root.setAttribute("aria-hidden", "true");
      root.innerHTML = iconSvg(icon);
    }
  }

  root.querySelectorAll<HTMLElement>(".material-symbols-outlined").forEach((element) => {
    const icon = element.dataset.icon || element.textContent?.trim();
    if (!icon) return;
    if (element.dataset.iconHydrated === icon) return;
    element.dataset.icon = icon;
    element.dataset.iconHydrated = icon;
    element.setAttribute("aria-hidden", "true");
    element.innerHTML = iconSvg(icon);
  });
}

export default function MaterialIconFallback() {
  useEffect(() => {
    hydrateIcons();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          if (mutation.target instanceof HTMLElement) hydrateIcons(mutation.target);
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) hydrateIcons(node as Element);
          });
        } else if (mutation.type === "characterData") {
          const parent = mutation.target.parentElement;
          if (parent?.classList.contains("material-symbols-outlined")) hydrateIcons(parent.parentElement || document);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
