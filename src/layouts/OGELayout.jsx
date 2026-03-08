import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

const headerNavItems = [
    { to: '/oge', label: 'Dashboard', isActive: (pathname) => pathname === '/oge' },
    { to: '/oge/application/1', label: 'Applications', isActive: (pathname) => pathname.includes('/oge/application/') },
    { to: '#', label: 'Analytics', isActive: () => false },
    { to: '#', label: 'Settings', isActive: () => false },
];

const sidebarNavItems = [
    { to: '/oge', icon: 'dashboard', label: 'Master View', isActive: (pathname) => pathname === '/oge' },
    { to: '#', icon: 'campaign', label: 'Manual Reminders', isActive: () => false },
    { to: '#', icon: 'warning', label: 'System Alerts', badge: '4', isActive: () => false },
    { to: '#', icon: 'account_balance', label: 'University Partners', isActive: () => false },
    { to: '#', icon: 'timer_10_alt_1', label: 'SLA Configuration', isActive: () => false },
    { to: '#', icon: 'add_circle', label: 'Create New Opportunity', isActive: () => false },
];

export default function OGELayout() {
    const { pathname } = useLocation();

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display transition-colors duration-200">
            <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-x-hidden">
                <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-3 bg-white dark:bg-slate-900 sticky top-0 z-50">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3 text-primary">
                            <span className="material-symbols-outlined text-3xl font-bold">diamond</span>
                            <h2 className="text-slate-900 dark:text-white text-xl font-bold leading-tight tracking-tight">PRISM</h2>
                        </div>
                        <label className="flex flex-col min-w-40 h-10 max-w-64">
                            <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                                <div className="text-slate-500 dark:text-slate-400 flex border-none bg-slate-100 dark:bg-slate-800 items-center justify-center pl-4 rounded-l-lg">
                                    <span className="material-symbols-outlined text-xl">search</span>
                                </div>
                                <input
                                    className="form-input flex w-full min-w-0 flex-1 border-none bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-0 h-full placeholder:text-slate-500 rounded-r-lg px-3 text-sm font-normal"
                                    placeholder="Search applications..."
                                />
                            </div>
                        </label>
                    </div>

                    <div className="flex flex-1 justify-end gap-8 items-center">
                        <nav className="hidden md:flex items-center gap-8">
                            {headerNavItems.map((item) => {
                                const active = item.isActive(pathname);
                                const commonClassName = active
                                    ? 'text-primary font-bold border-b-2 border-primary pb-1'
                                    : 'text-slate-600 dark:text-slate-400';

                                if (item.to === '#') {
                                    return (
                                        <a key={item.label} href="#" className={`text-sm font-medium hover:text-primary transition-colors ${commonClassName}`}>
                                            {item.label}
                                        </a>
                                    );
                                }

                                return (
                                    <Link key={item.to} to={item.to} className={`text-sm font-medium hover:text-primary transition-colors ${commonClassName}`}>
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="flex items-center gap-4">
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-400 cursor-pointer">notifications</span>
                            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-700"></div>
                        </div>
                    </div>
                </header>

                <div className="flex flex-1 overflow-hidden">
                    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-col hidden lg:flex h-full fixed left-0 top-16 z-40">
                        <div className="p-6">
                            <div className="flex flex-col mb-8">
                                <h1 className="text-slate-900 dark:text-white text-base font-bold">OGE Office</h1>
                                <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Admin Dashboard</p>
                            </div>

                            <nav className="flex flex-col gap-1">
                                {sidebarNavItems.map((item) => {
                                    const active = item.isActive(pathname);
                                    const className = active
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800';

                                    const content = (
                                        <>
                                            <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                                            <p className={`text-sm ${item.label === 'Master View' ? 'font-semibold' : 'font-medium'}`}>{item.label}</p>
                                            {item.badge && <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{item.badge}</span>}
                                        </>
                                    );

                                    if (item.to === '#') {
                                        return (
                                            <a key={item.label} href="#" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${className}`}>
                                                {content}
                                            </a>
                                        );
                                    }

                                    return (
                                        <Link key={item.to} to={item.to} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${className}`}>
                                            {content}
                                        </Link>
                                    );
                                })}
                            </nav>

                            <div className="mt-10 px-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Recent Alerts</p>
                                <div className="flex flex-col gap-4">
                                    <div className="flex gap-3">
                                        <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                                        <div>
                                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">SLA Breach: UPenn</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">2 hours ago</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="w-2 h-2 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                                        <div>
                                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">Near Breach: Berkeley</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">5 hours ago</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>

                    <main className="flex-1 flex flex-col min-w-0 bg-background-light dark:bg-background-dark p-6 lg:p-10 ml-64 overflow-y-auto">
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
}