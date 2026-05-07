import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
    {
        to: '/student',
        icon: 'explore',
        label: 'Opportunities',
        isActive: (pathname) => pathname === '/student',
    },
    {
        to: '/student/applications',
        icon: 'description',
        label: 'My Applications',
        isActive: (pathname) => pathname.includes('/student/applications'),
    },
    {
        to: '/student/messages',
        icon: 'mail',
        label: 'Messages',
        isActive: (pathname) => pathname.includes('/student/messages'),
    },
];

export default function StudentSidebar() {
    const { pathname } = useLocation();

    return (
        <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-screen fixed left-0 top-0 z-40">
            <div className="p-6 flex items-center gap-3">
                <div className="bg-primary/20 p-2 rounded-lg">
                    <span className="material-symbols-outlined text-primary">hub</span>
                </div>
                <div>
                    <h1 className="text-lg font-bold tracking-tight">PRISM</h1>
                    <p className="text-[10px] text-primary font-semibold uppercase tracking-wider leading-none">Student Mobility</p>
                </div>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-2">
                {navItems.map((item) => {
                    const active = item.isActive(pathname);

                    return (
                        <Link
                            key={item.to}
                            to={item.to}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                active
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            <span className={`text-sm ${active ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 mt-auto border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <div className="size-10 rounded-full bg-slate-300 overflow-hidden">
                        <img
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDDsfpxHTN65XtAnYWNbKlVoxMGvNadmOQeD1IqMFQ0bDgVZhDHWGTI250ADFnkBzfyX1XzvEiQHknYyIAY12IGmVfVKzDe29-vePYPQdp0ScQGcLf5-YEU4AXyvcGjQyZc3T7mbvQF7ba0Z7P9FWke-OG7tC76B7n4WJY9q5MWRj3H4nnKu-dRzjz1D_nbH1y36ZpEOSvtuQpnGrYzFhuH_KjA-TV3SJyxO7BFWpAV5RLCSkTzp_DJNQKEZzw6xTXswkNAm68mXA"
                            alt="Profile"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-bold truncate">Aditya Sharma</p>
                        <p className="text-xs text-slate-500 truncate">B.Tech 2025</p>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 text-sm">settings</span>
                </div>
            </div>
        </aside>
    );
}