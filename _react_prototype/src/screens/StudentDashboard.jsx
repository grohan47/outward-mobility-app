import React from 'react';

export default function StudentDashboard() {
    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen font-body">
            <div className="flex h-screen overflow-hidden">
                {/* Sidebar */}
                <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
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
                        <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <span className="material-symbols-outlined">explore</span>
                            <span className="text-sm font-medium">Opportunities</span>
                        </a>
                        <a href="#" className="flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary rounded-lg transition-colors">
                            <span className="material-symbols-outlined">description</span>
                            <span className="text-sm font-bold">My Applications</span>
                        </a>
                        <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <span className="material-symbols-outlined">mail</span>
                            <span className="text-sm font-medium">Messages</span>
                        </a>
                    </nav>
                    <div className="p-4 mt-auto border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800">
                            <div className="size-10 rounded-full bg-slate-300 overflow-hidden">
                                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDDsfpxHTN65XtAnYWNbKlVoxMGvNadmOQeD1IqMFQ0bDgVZhDHWGTI250ADFnkBzfyX1XzvEiQHknYyIAY12IGmVfVKzDe29-vePYPQdp0ScQGcLf5-YEU4AXyvcGjQyZc3T7mbvQF7ba0Z7P9FWke-OG7tC76B7n4WJY9q5MWRj3H4nnKu-dRzjz1D_nbH1y36ZpEOSvtuQpnGrYzFhuH_KjA-TV3SJyxO7BFWpAV5RLCSkTzp_DJNQKEZzw6xTXswkNAm68mXA" alt="Profile" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-bold truncate">Aditya Sharma</p>
                                <p className="text-xs text-slate-500 truncate">B.Tech 2025</p>
                            </div>
                            <span className="material-symbols-outlined text-slate-400 text-sm">settings</span>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
                    <div className="max-w-7xl mx-auto p-8">
                        <header className="mb-8">
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Student Dashboard</h2>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">Welcome back to Plaksha Review Interface for Student Mobility</p>
                        </header>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                            <div className="lg:col-span-2 space-y-8">

                                {/* Pending Requests */}
                                <section>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xl font-bold flex items-center gap-2">
                                            <span className="material-symbols-outlined text-amber-500">priority_high</span>
                                            Pending Requests
                                        </h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-5 rounded-xl flex gap-4">
                                            <div className="bg-amber-100 dark:bg-amber-900/40 p-3 rounded-full h-fit flex-shrink-0">
                                                <span className="material-symbols-outlined text-amber-600">videocam</span>
                                            </div>
                                            <div className="flex-1">
                                                <h5 className="text-sm font-bold text-slate-900 dark:text-white">Interview Invite</h5>
                                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Dr. Sarah Jenkins from NUS wants to schedule a quick 15-minute clarification call regarding your research proposal.</p>
                                                <div className="mt-4 flex gap-2">
                                                    <button className="bg-amber-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors">Pick a slot</button>
                                                    <button className="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/30 text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 dark:text-slate-300">View Details</button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 p-5 rounded-xl flex gap-4">
                                            <div className="bg-blue-100 dark:bg-blue-900/40 p-3 rounded-full h-fit flex-shrink-0">
                                                <span className="material-symbols-outlined text-blue-600">attach_file</span>
                                            </div>
                                            <div className="flex-1">
                                                <h5 className="text-sm font-bold text-slate-900 dark:text-white">Missing Document</h5>
                                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">OGE office requires a clearer scan of your Semester 4 Grade Sheet to proceed with the verification.</p>
                                                <div className="mt-4 flex gap-2">
                                                    <button className="bg-blue-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors">Upload File</button>
                                                    <button className="bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-900/30 text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 dark:text-slate-300">Dismiss</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Active Applications */}
                                <section>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xl font-bold flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary">pending_actions</span>
                                            Active Applications
                                        </h3>
                                        <span className="text-xs font-semibold bg-slate-200 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-600 dark:text-slate-400">2 Ongoing</span>
                                    </div>
                                    <div className="space-y-4">
                                        {/* App 1 */}
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                            <div className="h-32 w-full overflow-hidden relative">
                                                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDUpjX9pChEJGglFfqoXpy6PymTLlq8yh689rIP3XhBQbPlR7SWOlfI3k0QgxUFLTvoWE2i9Bd-3vSfxTFtKQS4dule54LIfS2icVH2Kl-HUNM5zX8sDvtvkWX_k2IFDuKkf2OSrZjbGVHBRq1BpYve-2dwieWEX6rJAYtqj0vRY1Bu9Q7I32xqf9K3g4JeQw4zmmCBC1smc5whqyQBzJAXgbPJ5eg2cs-x46kmg7zVbCPRUqK2jZzgd8Ag3dqW_CVUWtqUGbSyBw" alt="University" className="w-full h-full object-cover" />
                                                <div className="absolute top-3 left-3 px-2 py-1 bg-primary text-white text-[10px] font-bold rounded">TOP CHOICE</div>
                                            </div>
                                            <div className="p-5">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Global Exchange Program 2024</p>
                                                        <h4 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">National University of Singapore</h4>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">Under Review</span>
                                                        <p className="text-[9px] text-slate-400 mt-1 uppercase">2h ago</p>
                                                    </div>
                                                </div>
                                                {/* Timeline */}
                                                <div className="relative pt-2 pb-2">
                                                    <div className="absolute top-[18px] left-[10%] right-[10%] h-[1px] bg-slate-100 dark:bg-slate-800 -z-0"></div>
                                                    <div className="absolute top-[18px] left-[10%] w-[40%] h-[1px] bg-primary -z-0"></div>
                                                    <div className="grid grid-cols-5 gap-0 relative z-10">
                                                        {[
                                                            { label: 'Submission', status: 'done' },
                                                            { label: 'UG Office', status: 'done' },
                                                            { label: 'Chair', status: 'current' },
                                                            { label: 'OGE', status: 'todo' },
                                                            { label: 'Dean', status: 'todo' },
                                                        ].map((step, idx) => (
                                                            <div key={idx} className="flex flex-col items-center text-center">
                                                                <div className={`size-5 rounded-full flex items-center justify-center text-white ring-4 ring-white dark:ring-slate-900 ${step.status === 'done' ? 'bg-primary' :
                                                                        step.status === 'current' ? 'bg-white dark:bg-slate-900 border border-primary text-primary' :
                                                                            'bg-white dark:bg-slate-900 border border-slate-200 text-slate-300'
                                                                    }`}>
                                                                    <span className="material-symbols-outlined text-[10px]">
                                                                        {step.status === 'done' ? 'check' : step.status === 'current' ? 'schedule' : 'circle'}
                                                                    </span>
                                                                </div>
                                                                <p className={`mt-2 text-[9px] font-bold ${step.status === 'current' ? 'text-primary' :
                                                                        step.status === 'todo' ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'
                                                                    }`}>{step.label}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* App 2 */}
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm opacity-90 hover:opacity-100 transition-all">
                                            <div className="h-32 w-full overflow-hidden">
                                                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCOTY3z5rBBYPqVfJe5_IjttN6wJmLYNFM-QesyhUCkQ3CDwAu3fQS_qspwyuTH2-YNOU-RMFzXEYuPJHah-bBZABDna45wB9MbvZ5PL1zvpD3mHDDkPCGinpbsqEnWIialJDDEjcPV0g89ODcWBQP4iQjAn6Sx31YljmDa_JtbYraKA_iF6Bg1OkoIe-qDpfAympAbK14b0TiGTgJz6IzVENUWWS9lo9lcEY7ZAjzJeTWNYqNlJicyUMW5n3KraeaeMLspgQGXNg" alt="University" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="p-5">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Summer Research Internship</p>
                                                        <h4 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Georgia Institute of Technology</h4>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">Draft</span>
                                                        <p className="text-[9px] text-slate-400 mt-1 uppercase">Saved 1d ago</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <button className="bg-primary text-white text-[10px] font-bold px-4 py-1.5 rounded-lg hover:bg-primary/90 transition-colors">Continue Application</button>
                                                    <button className="text-slate-500 text-[10px] font-bold hover:text-red-500 transition-colors">Delete Draft</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Sidebar Right */}
                            <aside className="space-y-6">
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
                                    <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                                        <span className="material-symbols-outlined text-primary text-lg">auto_awesome</span>
                                        New Opportunities
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="group cursor-pointer">
                                            <div className="w-full h-24 rounded-lg bg-slate-100 mb-2 overflow-hidden">
                                                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDUpjX9pChEJGglFfqoXpy6PymTLlq8yh689rIP3XhBQbPlR7SWOlfI3k0QgxUFLTvoWE2i9Bd-3vSfxTFtKQS4dule54LIfS2icVH2Kl-HUNM5zX8sDvtvkWX_k2IFDuKkf2OSrZjbGVHBRq1BpYve-2dwieWEX6rJAYtqj0vRY1Bu9Q7I32xqf9K3g4JeQw4zmmCBC1smc5whqyQBzJAXgbPJ5eg2cs-x46kmg7zVbCPRUqK2jZzgd8Ag3dqW_CVUWtqUGbSyBw" alt="University" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                            </div>
                                            <p className="text-[10px] font-bold text-primary uppercase">Fall Exchange</p>
                                            <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">ETH Zurich</h5>
                                            <p className="text-[11px] text-slate-500 line-clamp-2">Research excellence in the heart of Europe. Applications open next week.</p>
                                        </div>
                                        <hr className="border-slate-100 dark:border-slate-800" />
                                        <div className="group cursor-pointer">
                                            <div className="w-full h-24 rounded-lg bg-slate-100 mb-2 overflow-hidden">
                                                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCOTY3z5rBBYPqVfJe5_IjttN6wJmLYNFM-QesyhUCkQ3CDwAu3fQS_qspwyuTH2-YNOU-RMFzXEYuPJHah-bBZABDna45wB9MbvZ5PL1zvpD3mHDDkPCGinpbsqEnWIialJDDEjcPV0g89ODcWBQP4iQjAn6Sx31YljmDa_JtbYraKA_iF6Bg1OkoIe-qDpfAympAbK14b0TiGTgJz6IzVENUWWS9lo9lcEY7ZAjzJeTWNYqNlJicyUMW5n3KraeaeMLspgQGXNg" alt="University" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                            </div>
                                            <p className="text-[10px] font-bold text-primary uppercase">Internship</p>
                                            <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">Stanford University</h5>
                                            <p className="text-[11px] text-slate-500 line-clamp-2">Summer research program in Artificial Intelligence and Robotics.</p>
                                        </div>
                                    </div>
                                    <button className="w-full mt-6 py-2 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors">View All Opportunities</button>
                                </div>
                                <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
                                        <span className="material-symbols-outlined text-primary">tips_and_updates</span>
                                        Reviewer Tip
                                    </h4>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">Applications with a personal statement exceeding 500 words usually get faster feedback from Program Chairs.</p>
                                </div>
                            </aside>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
