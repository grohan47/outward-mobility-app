import { c as create_ssr_component, b as subscribe, v as validate_component } from "../../../chunks/ssr.js";
import { p as page } from "../../../chunks/stores.js";
import { e as escape } from "../../../chunks/escape.js";
const StudentSidebar = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $page, $$unsubscribe_page;
  $$unsubscribe_page = subscribe(page, (value) => $page = value);
  $$unsubscribe_page();
  return `<aside class="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-screen fixed left-0 top-0 z-40"><div class="p-6 flex items-center gap-3" data-svelte-h="svelte-4v1o2v"><div class="bg-primary/20 p-2 rounded-lg"><span class="material-symbols-outlined text-primary">hub</span></div> <div><h1 class="text-lg font-bold tracking-tight">PRISM</h1> <p class="text-[10px] text-primary font-semibold uppercase tracking-wider leading-none">Student Mobility</p></div></div> <nav class="flex-1 px-4 py-4 space-y-2"><a href="/student" class="${"flex items-center gap-3 px-4 py-3 rounded-lg transition-colors " + escape(
    $page.url.pathname === "/student" ? "bg-primary/10 text-primary" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
    true
  )}"><span class="material-symbols-outlined" data-svelte-h="svelte-17s1hn2">explore</span> <span class="${"text-sm font-medium " + escape($page.url.pathname === "/student" ? "font-bold" : "", true)}">Opportunities</span></a> <a href="/student/applications" class="${"flex items-center gap-3 px-4 py-3 rounded-lg transition-colors " + escape(
    $page.url.pathname.includes("/student/applications") ? "bg-primary/10 text-primary" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
    true
  )}"><span class="material-symbols-outlined" data-svelte-h="svelte-1q95bg1">description</span> <span class="${"text-sm font-medium " + escape(
    $page.url.pathname.includes("/student/applications") ? "font-bold" : "",
    true
  )}">My Applications</span></a> <a href="/student/messages" class="${"flex items-center gap-3 px-4 py-3 rounded-lg transition-colors " + escape(
    $page.url.pathname.includes("/student/messages") ? "bg-primary/10 text-primary" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
    true
  )}"><span class="material-symbols-outlined" data-svelte-h="svelte-yfvfv0">mail</span> <span class="${"text-sm font-medium " + escape(
    $page.url.pathname.includes("/student/messages") ? "font-bold" : "",
    true
  )}">Messages</span></a></nav> <div class="p-4 mt-auto border-t border-slate-200 dark:border-slate-800" data-svelte-h="svelte-1y90bpz"><div class="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800"><div class="size-10 rounded-full bg-slate-300 overflow-hidden"><img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDDsfpxHTN65XtAnYWNbKlVoxMGvNadmOQeD1IqMFQ0bDgVZhDHWGTI250ADFnkBzfyX1XzvEiQHknYyIAY12IGmVfVKzDe29-vePYPQdp0ScQGcLf5-YEU4AXyvcGjQyZc3T7mbvQF7ba0Z7P9FWke-OG7tC76B7n4WJY9q5MWRj3H4nnKu-dRzjz1D_nbH1y36ZpEOSvtuQpnGrYzFhuH_KjA-TV3SJyxO7BFWpAV5RLCSkTzp_DJNQKEZzw6xTXswkNAm68mXA" alt="Profile" class="w-full h-full object-cover"></div> <div class="flex-1 overflow-hidden"><p class="text-sm font-bold truncate">Aditya Sharma</p> <p class="text-xs text-slate-500 truncate">B.Tech 2025</p></div> <span class="material-symbols-outlined text-slate-400 text-sm">settings</span></div></div></aside>`;
});
const Layout = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return `<div class="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark font-body">${validate_component(StudentSidebar, "StudentSidebar").$$render($$result, {}, {}, {})} <main class="flex-1 overflow-y-auto ml-64 p-8"><header class="mb-8" data-svelte-h="svelte-lugiti"><h2 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Student Dashboard</h2> <p class="text-slate-500 dark:text-slate-400 mt-1">Welcome back to Plaksha Review Interface for Student Mobility</p></header> ${slots.default ? slots.default({}) : ``}</main></div>`;
});
export {
  Layout as default
};
