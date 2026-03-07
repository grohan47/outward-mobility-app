import React from 'react';

export default function StudentLifeReview() {
    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen font-display overflow-x-hidden">
            <div className="flex min-h-screen flex-col">
                {/* Header */}
                <header className="flex items-center justify-between border-b border-solid border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-6 lg:px-10 py-3 sticky top-0 z-50 h-[65px]">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-4 text-primary">
                            <div className="size-8 flex items-center justify-center bg-primary/10 rounded-lg">
                                <span className="material-symbols-outlined text-primary">diamond</span>
                            </div>
                            <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-tight">PRISM</h2>
                        </div>
                        <label className="hidden md:flex flex-col min-w-40 h-10 max-w-64">
                            <div className="flex w-full flex-1 items-stretch rounded-lg h-full overflow-hidden">
                                <div className="text-slate-500 flex bg-slate-100 dark:bg-slate-800 items-center justify-center pl-4">
                                    <span className="material-symbols-outlined text-[20px]">search</span>
                                </div>
                                <input className="w-full flex-1 border-none bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-0 h-full placeholder:text-slate-400 px-4 pl-2 text-sm" placeholder="Search applications..." />
                            </div>
                        </label>
                    </div>
                    <div className="flex flex-1 justify-end gap-4 lg:gap-8">
                        <nav className="hidden lg:flex items-center gap-9">
                            <a href="#" className="text-slate-600 dark:text-slate-300 text-sm font-medium hover:text-primary transition-colors">Dashboard</a>
                            <a href="#" className="text-primary text-sm font-medium border-b-2 border-primary py-1">Applications</a>
                            <a href="#" className="text-slate-600 dark:text-slate-300 text-sm font-medium hover:text-primary transition-colors">Reports</a>
                            <a href="#" className="text-slate-600 dark:text-slate-300 text-sm font-medium hover:text-primary transition-colors">Settings</a>
                        </nav>
                        <div className="bg-slate-200 dark:bg-slate-700 rounded-full size-10 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-800">
                            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDDEzHgWKJnp1wCIAVhYA_kCoSTw-iAsmeA6wePniWoVdYqMsK6U-kNSqJbce8xbaf8g8S_67jGseNKMwS7XOjtLrXPKCSbt1tBgPYqttnSShPWq30Y6ZpHzyHWZgg4PJd8wHrBjnhA71j6GOY6m9CrzJkDuRI-rk47Lm2uLb_jS4VJrDS1oKDybnRJO8yQX0wuLVDl6wo73RygzKWRzfhWUJQDuQ9gbH31UQhqMCyiq9Wr3cn-mWC-KbKHWUCw7wPsWzw6oR_KAQ" alt="User profile" className="w-full h-full object-cover" />
                        </div>
                    </div>
                </header>

                <div className="flex flex-1 min-h-0 w-full">
                    <aside className="hidden lg:flex w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex-col gap-6 shrink-0 h-full">
                        <div>
                            <h1 className="text-slate-900 dark:text-white text-base font-bold">Application Review</h1>
                            <p className="text-primary text-xs font-semibold uppercase tracking-wider mt-1">ID: #APP-2024-9872</p>
                        </div>
                        <nav className="flex flex-col gap-1">
                            <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg group">
                                <span className="material-symbols-outlined text-[20px]">dashboard</span>
                                <span className="text-sm font-medium">Overview</span>
                            </a>
                            <a href="#" className="flex items-center gap-3 px-3 py-2 bg-primary/10 text-primary rounded-lg font-semibold">
                                <span className="material-symbols-outlined text-[20px]">groups</span>
                                <span className="text-sm">Student Life</span>
                            </a>
                            <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
                                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                                <span className="text-sm font-medium">Final Decision</span>
                            </a>
                        </nav>
                        <div className="mt-auto p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                            <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Review SLA</p>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mb-2">
                                <div className="bg-primary h-1.5 rounded-full" style={{ width: '66%' }}></div>
                            </div>
                            <p className="text-[11px] text-slate-700 dark:text-slate-300">2 of 3 days elapsed</p>
                        </div>
                    </aside>

                    <section className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-background-light dark:bg-background-dark">
                        <div className="max-w-5xl mx-auto space-y-8">
                            <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                                <div className="flex gap-4 sm:gap-6 items-center min-w-0">
                                    <div className="size-24 rounded-full border-4 border-white dark:border-slate-800 shadow-sm overflow-hidden bg-slate-200 shrink-0">
                                        <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCRlKshnDammZV2A7Gn0QH7FXTjNqz2dK_qXr5NGg1bAU91V9otOFL_40-xvb7RNDW_0QAoAvIGZi4k-LcuM3fa-ZmN0H2xVKqylpeA7NOv9BzpCqXfl0JktKVFpFGg4uRy6Ut3bWus1p0fYWcuv1NIYGc0t-eAZGqaM6tZK-aTkAVN3fZau74gW-WPIEGWPX-XFq7POQroeOBzDWgEoSULPTaJRq_dQknVkzD-pWNcA2JpKQshITD6z2sCV_jwhPaTyjxZBX009g" alt="Portrait" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">Alex Johnson</h2>
                                        <p className="text-slate-500 dark:text-slate-400 font-medium">Applied for: Semester Exchange 2024</p>
                                        <div className="flex gap-2 mt-2">
                                            <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded uppercase">Undergraduate</span>
                                            <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded uppercase">Level 3 Review</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3 self-start xl:self-auto">
                                    <button className="px-5 py-2.5 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 font-bold text-sm flex items-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/20 transition-all">
                                        <span className="material-symbols-outlined text-[20px]">flag</span>
                                        Flag
                                    </button>
                                    <button className="px-8 py-2.5 rounded-lg bg-primary text-white font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20">
                                        <span className="material-symbols-outlined text-[20px]">check</span>
                                        Approve
                                    </button>
                                </div>
                            </div>

                            <div className="grid gap-6 pb-8">
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">gavel</span>
                                        Conduct & Integrity Records
                                    </h3>
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Disciplinary History</label>
                                            <textarea className="w-full rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm focus:ring-primary focus:border-primary placeholder:text-slate-400 form-textarea" placeholder="Enter any previous disciplinary actions or 'None' if clear..." rows="3"></textarea>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Academic Integrity Record</label>
                                            <textarea className="w-full rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm focus:ring-primary focus:border-primary placeholder:text-slate-400 form-textarea" placeholder="Details of plagiarism or integrity issues..." rows="3"></textarea>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">diversity_3</span>
                                        Extracurricular & Leadership Notes
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Notes on Community Contribution</label>
                                            <textarea className="w-full rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm focus:ring-primary focus:border-primary placeholder:text-slate-400 form-textarea" placeholder="Summarize applicant's leadership roles and student life impact..." rows="4"></textarea>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <aside className="hidden 2xl:flex w-[360px] border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-col shrink-0 h-full">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                                    <span className="material-symbols-outlined text-[18px]">mail</span>
                                    Communications
                                </h3>
                                <span className="flex size-2 bg-primary rounded-full"></span>
                            </div>
                            <div className="flex gap-2">
                                <button className="flex-1 py-1.5 px-3 bg-primary/10 text-primary text-[11px] font-bold rounded border border-primary/20">General</button>
                                <button className="flex-1 py-1.5 px-3 bg-slate-50 dark:bg-slate-800 text-slate-500 text-[11px] font-bold rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Internal Review</button>
                                <button className="flex-1 py-1.5 px-3 bg-slate-50 dark:bg-slate-800 text-slate-500 text-[11px] font-bold rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Registrar</button>
                            </div>
                        </div>
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/20 space-y-3">
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400 font-medium w-8">To:</span>
                                <input className="flex-1 bg-transparent border-none p-0 text-slate-700 dark:text-slate-300 focus:ring-0 text-xs font-medium" type="text" defaultValue="registrar-office@university.edu" />
                            </div>
                            <div className="relative">
                                <textarea className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-primary focus:border-primary p-3 min-h-[100px] form-textarea" placeholder="Draft your email response..."></textarea>
                                <div className="absolute right-2 bottom-2 flex gap-2">
                                    <button className="p-1.5 text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined text-[18px]">attach_file</span></button>
                                    <button className="bg-primary text-white p-1.5 rounded flex items-center justify-center hover:opacity-90"><span className="material-symbols-outlined text-[18px]">send</span></button>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {/* Thread */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="size-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[11px] font-bold text-slate-500">AM</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-baseline">
                                            <span className="text-xs font-bold text-slate-900 dark:text-white">Admissions Manager</span>
                                            <span className="text-[10px] text-slate-400">10:45 AM</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500">To: Student Life Committee</p>
                                    </div>
                                </div>
                                <div className="pl-10">
                                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                        Dear Team, <br /><br />
                                        Please verify the integrity record for the Summer 2023 session specifically for Alex Johnson. There was a mention of a late submission appeal that needs clarification.
                                        <br /><br /> Best, <br /> Sarah (Admissions)
                                    </div>
                                </div>
                            </div>
                            {/* Reply */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 justify-end">
                                    <div className="flex-1 text-right">
                                        <div className="flex justify-between items-baseline flex-row-reverse">
                                            <span className="text-xs font-bold text-primary">You</span>
                                            <span className="text-[10px] text-slate-400">11:12 AM</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500">To: Admissions Manager, Registrar</p>
                                    </div>
                                    <div className="size-8 rounded bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary">ME</div>
                                </div>
                                <div className="pr-10">
                                    <div className="bg-primary/5 p-3 rounded-lg border border-primary/10 text-xs text-slate-700 dark:text-slate-300 leading-relaxed text-right">
                                        Checking with the registrar's office now. Will update this thread once I have the records from the Summer 2023 session.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}
