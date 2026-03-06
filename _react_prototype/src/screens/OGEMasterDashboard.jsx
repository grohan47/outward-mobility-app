import React from 'react';

export default function OGEMasterDashboard() {
    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display transition-colors duration-200">
            <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-x-hidden">
                {/* Header */}
                <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-3 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3 text-primary">
                            <span className="material-symbols-outlined text-3xl font-bold">diamond</span>
                            <h2 className="text-slate-900 dark:text-white text-xl font-bold leading-tight tracking-tight">PRISM</h2>
                        </div>
                        <label className="flex flex-col min-w-40 h-10 max-w-64">
                            <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                                <div className="text-slate-500 dark:text-slate-400 flex border-none bg-slate-100 dark:bg-slate-800 items-center justify-center pl-4 rounded-l-lg" data-icon="Search">
                                    <span className="material-symbols-outlined text-xl">search</span>
                                </div>
                                <input className="form-input flex w-full min-w-0 flex-1 border-none bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-0 h-full placeholder:text-slate-500 rounded-r-lg px-3 text-sm font-normal" placeholder="Search applications..." />
                            </div>
                        </label>
                    </div>
                    <div className="flex flex-1 justify-end gap-8 items-center">
                        <nav className="hidden md:flex items-center gap-8">
                            <a href="#" className="text-primary text-sm font-semibold border-b-2 border-primary pb-1">Dashboard</a>
                            <a href="#" className="text-slate-600 dark:text-slate-400 text-sm font-medium hover:text-primary transition-colors">Applications</a>
                            <a href="#" className="text-slate-600 dark:text-slate-400 text-sm font-medium hover:text-primary transition-colors">Analytics</a>
                            <a href="#" className="text-slate-600 dark:text-slate-400 text-sm font-medium hover:text-primary transition-colors">Settings</a>
                        </nav>
                        <div className="flex items-center gap-4">
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-400 cursor-pointer">notifications</span>
                            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border border-slate-200 dark:border-slate-700" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBEtJvvnxqXSspHIbKms2PJkI-gf76aLBYoS4YeNJzNMhvuc_Shp9j8E5Zrh2GcWKhFFsU0AfC8qpjDvsNZLG5HxWQ3qbjHFcRGr7y9QiHT8oZS1M6ykrClajJ8_P5qfg-2oCTBg_rT_O3ikcdBKAAFHWSE90V4-BII320EfL4omjqTBwIOZz7a0uEhiPmyfP8uIR4AlZyQafwqhjgb2-crDYiLdzqV7NeNuEytA9bHZIIR-FEZfvEbboDS3arC3_HegKhapbQ6ZA")' }}></div>
                        </div>
                    </div>
                </header>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-col hidden lg:flex">
                        <div className="p-6">
                            <div className="flex flex-col mb-8">
                                <h1 className="text-slate-900 dark:text-white text-base font-bold">OGE Office</h1>
                                <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Admin Dashboard</p>
                            </div>
                            <nav className="flex flex-col gap-1">
                                <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/10 text-primary">
                                    <span className="material-symbols-outlined text-[22px]">dashboard</span>
                                    <p className="text-sm font-semibold">Master View</p>
                                </a>
                                <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <span className="material-symbols-outlined text-[22px]">campaign</span>
                                    <p className="text-sm font-medium">Manual Reminders</p>
                                </a>
                                <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <span className="material-symbols-outlined text-[22px]">warning</span>
                                    <p className="text-sm font-medium">System Alerts</p>
                                    <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">4</span>
                                </a>
                                <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <span className="material-symbols-outlined text-[22px]">account_balance</span>
                                    <p className="text-sm font-medium">University Partners</p>
                                </a>
                                <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <span className="material-symbols-outlined text-[22px]">timer_10_alt_1</span>
                                    <p className="text-sm font-medium">SLA Configuration</p>
                                </a>
                            </nav>
                            <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800">
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-4 px-3">Recent Alerts</p>
                                <div className="flex flex-col gap-4">
                                    <div className="flex gap-3 px-3">
                                        <div className="size-2 rounded-full bg-red-500 mt-1.5"></div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">SLA Breach: UPenn</p>
                                            <p className="text-[10px] text-slate-500">2 hours ago</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 px-3">
                                        <div className="size-2 rounded-full bg-orange-400 mt-1.5"></div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">Near Breach: Berkeley</p>
                                            <p className="text-[10px] text-slate-500">5 hours ago</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 flex flex-col min-w-0 bg-background-light dark:bg-background-dark p-6 lg:p-10 overflow-y-auto">
                        <div className="flex flex-wrap items-center gap-2 mb-4 text-sm text-slate-500 dark:text-slate-400">
                            <span>Home</span>
                            <span className="material-symbols-outlined text-sm">chevron_right</span>
                            <span className="text-slate-900 dark:text-white font-medium">Master Dashboard</span>
                        </div>
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                            <div className="flex flex-col gap-1">
                                <h1 className="text-slate-900 dark:text-white text-3xl font-black leading-tight tracking-tight">PRISM Master Dashboard</h1>
                                <p className="text-slate-500 dark:text-slate-400 text-base font-normal">Track and manage student mobility across all university partners.</p>
                            </div>
                            <div className="flex gap-3">
                                <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity">
                                    <span className="material-symbols-outlined text-xl">download</span>
                                    Export Data
                                </button>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap gap-3 mb-6 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                            <button className="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <span>University: All</span>
                                <span className="material-symbols-outlined text-lg">expand_more</span>
                            </button>
                            <button className="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <span>Status: Active</span>
                                <span className="material-symbols-outlined text-lg">expand_more</span>
                            </button>
                            <button className="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <span>Priority: High</span>
                                <span className="material-symbols-outlined text-lg">expand_more</span>
                            </button>
                            <button className="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <span>SLA: Near Breach</span>
                                <span className="material-symbols-outlined text-lg">expand_more</span>
                            </button>
                            <div className="flex-1"></div>
                            <button className="flex items-center gap-2 px-4 py-2 text-slate-500 text-sm font-medium hover:text-primary transition-colors">
                                <span className="material-symbols-outlined text-lg">filter_alt_off</span>
                                Clear Filters
                            </button>
                        </div>

                        {/* Table */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Student Name</th>
                                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Target University</th>
                                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Current Stage & Progress</th>
                                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Time Remaining</th>
                                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Flags</th>
                                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {/* Row 1 */}
                                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">AS</div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-slate-900 dark:text-white">Arjun Sharma</span>
                                                        <span className="text-[10px] text-slate-500">ID: PL-2024-001</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">UC Berkeley</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col gap-2">
                                                    <span className="inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                        Student Life Review
                                                    </span>
                                                    <div className="flex gap-1 w-24">
                                                        <div className="h-1 flex-1 rounded-full bg-primary"></div>
                                                        <div className="h-1 flex-1 rounded-full bg-primary"></div>
                                                        <div className="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                                                        <div className="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                                                        <div className="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-red-500" style={{ width: '85%' }}></div>
                                                    </div>
                                                    <span className="text-xs font-bold text-red-600">1 Day Left</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex gap-1">
                                                    <span className="material-symbols-outlined text-orange-500 text-base" title="Missing Documents">description</span>
                                                    <span className="material-symbols-outlined text-red-500 text-base" title="Urgent Action Required">priority_high</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                <button className="text-slate-400 hover:text-primary transition-colors">
                                                    <span className="material-symbols-outlined">more_vert</span>
                                                </button>
                                            </td>
                                        </tr>
                                        {/* Row 2 */}
                                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">MK</div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-slate-900 dark:text-white">Meera Kapoor</span>
                                                        <span className="text-[10px] text-slate-500">ID: PL-2024-042</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">UPenn</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col gap-2">
                                                    <span className="inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                                        Academic Verification
                                                    </span>
                                                    <div className="flex gap-1 w-24">
                                                        <div className="h-1 flex-1 rounded-full bg-primary"></div>
                                                        <div className="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                                                        <div className="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                                                        <div className="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                                                        <div className="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-orange-400" style={{ width: '60%' }}></div>
                                                    </div>
                                                    <span className="text-xs font-bold text-orange-500">3 Days Left</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="material-symbols-outlined text-slate-300 text-base">remove_circle_outline</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                <button className="text-slate-400 hover:text-primary transition-colors">
                                                    <span className="material-symbols-outlined">more_vert</span>
                                                </button>
                                            </td>
                                        </tr>
                                        {/* Add more rows if needed, keeping it brief */}
                                    </tbody>
                                </table>
                            </div>

                            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                <p className="text-sm text-slate-500 dark:text-slate-400">Showing <span className="font-semibold">2</span> of <span className="font-semibold">124</span> applications</p>
                                <div className="flex gap-2">
                                    <button className="px-3 py-1 text-sm font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-colors disabled:opacity-50">Previous</button>
                                    <button className="px-3 py-1 text-sm font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-colors">Next</button>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
