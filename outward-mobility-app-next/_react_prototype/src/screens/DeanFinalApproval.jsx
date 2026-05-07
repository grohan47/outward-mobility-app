import React from 'react';

export default function DeanFinalApproval() {
    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen">
            <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark group/design-root overflow-x-hidden">
                <div className="layout-container flex h-full grow flex-col">
                    {/* Header */}
                    <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-10 py-3">
                        <div className="flex items-center gap-8">
                            <div className="flex items-center gap-4 text-primary">
                                <div className="size-6">
                                    <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                        <g clipPath="url(#clip0_6_535)">
                                            <path clipRule="evenodd" d="M47.2426 24L24 47.2426L0.757355 24L24 0.757355L47.2426 24ZM12.2426 21H35.7574L24 9.24264L12.2426 21Z" fill="currentColor" fillRule="evenodd"></path>
                                        </g>
                                        <defs>
                                            <clipPath id="clip0_6_535"><rect fill="white" height="48" width="48"></rect></clipPath>
                                        </defs>
                                    </svg>
                                </div>
                                <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">PRISM</h2>
                            </div>
                            <div className="flex items-center gap-9">
                                <a className="text-slate-600 dark:text-slate-400 text-sm font-medium leading-normal hover:text-primary" href="#">Dashboard</a>
                                <a className="text-primary text-sm font-bold leading-normal border-b-2 border-primary py-1" href="#">Pending Reviews</a>
                                <a className="text-slate-600 dark:text-slate-400 text-sm font-medium leading-normal hover:text-primary" href="#">Archive</a>
                                <a className="text-slate-600 dark:text-slate-400 text-sm font-medium leading-normal hover:text-primary" href="#">Reports</a>
                            </div>
                        </div>
                        <div className="flex flex-1 justify-end gap-8">
                            <label className="flex flex-col min-w-40 !h-10 max-w-64">
                                <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                                    <div className="text-slate-500 flex border-none bg-slate-100 dark:bg-slate-800 items-center justify-center pl-4 rounded-l-lg" data-icon="search">
                                        <span className="material-symbols-outlined">search</span>
                                    </div>
                                    <input className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-white focus:outline-0 focus:ring-0 border-none bg-slate-100 dark:bg-slate-800 placeholder:text-slate-500 px-4 rounded-l-none pl-2 text-base font-normal" placeholder="Search applications" />
                                </div>
                            </label>
                            <div className="flex gap-2">
                                <button className="flex max-w-[480px] cursor-pointer items-center justify-center rounded-lg h-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5">
                                    <span className="material-symbols-outlined text-[20px]">notifications</span>
                                </button>
                                <button className="flex max-w-[480px] cursor-pointer items-center justify-center rounded-lg h-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5">
                                    <span className="material-symbols-outlined text-[20px]">help</span>
                                </button>
                            </div>
                            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border border-slate-200 dark:border-slate-700" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCM8VDvds59Vd8JqmxP2m5yX6IvknT6mxjYbUisLvONi2sDTsr0hM2-7SCOFoipzS8KlF6XdfBvFfEu2vBWiT-eu3_nQQ5-mLGJeUTy7o4QfHB7xjB7gsWu9OsPMgRsOB10zxpldVHwzsSJyAbKFG78AjgH_o2JLjdVmtZGNMMIr2ZkLrfultV6kyTxwqzRtwPXshD-oGbXKnKCRbHYWXR9UNW4SsyP57Kw6ipsAnq5SXXBg7BEQkTgxlvgXH89eD695Hb_b7GCqg")' }}></div>
                        </div>
                    </header>

                    <main className="flex flex-1 overflow-hidden h-[calc(100vh-64px)]">
                        {/* Sidebar */}
                        <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-6">
                            <div className="flex flex-col">
                                <h1 className="text-slate-900 dark:text-white text-base font-bold">Final Approval</h1>
                                <p className="text-primary text-xs font-semibold uppercase tracking-wider">Dean Review Level 1</p>
                            </div>
                            <nav className="flex flex-col gap-1">
                                <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                    <span className="material-symbols-outlined text-slate-500">dashboard</span>
                                    <p className="text-slate-700 dark:text-slate-300 text-sm font-medium">Overview</p>
                                </div>
                                <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                    <span className="material-symbols-outlined text-slate-500">person</span>
                                    <p className="text-slate-700 dark:text-slate-300 text-sm font-medium">Student Profile</p>
                                </div>
                                <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                    <span className="material-symbols-outlined text-slate-500">school</span>
                                    <p className="text-slate-700 dark:text-slate-300 text-sm font-medium">Academic Records</p>
                                </div>
                                <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 text-primary">
                                    <span className="material-symbols-outlined">verified_user</span>
                                    <p className="text-sm font-bold">Review Decisions</p>
                                </div>
                                <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                    <span className="material-symbols-outlined text-slate-500">history</span>
                                    <p className="text-slate-700 dark:text-slate-300 text-sm font-medium">Audit Trail</p>
                                </div>
                            </nav>
                            <div className="mt-auto p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Priority Status</p>
                                <div className="flex items-center gap-2">
                                    <span className="size-2 rounded-full bg-orange-500"></span>
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">High Priority</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Deadline: Oct 12, 2024</p>
                            </div>
                        </aside>

                        {/* Main Content */}
                        <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark overflow-y-auto">
                            <div className="px-8 pt-6 flex flex-col gap-1">
                                <div className="flex items-center gap-2 text-slate-500 text-sm">
                                    <span>Reviews</span>
                                    <span className="material-symbols-outlined text-xs">chevron_right</span>
                                    <span className="text-slate-900 dark:text-slate-200 font-medium">Aryan Sharma - PRISM-2024-001</span>
                                </div>
                                <div className="flex justify-between items-end mt-4 pb-6 border-b border-slate-200 dark:border-slate-800">
                                    <div>
                                        <h2 className="text-3xl font-black text-slate-900 dark:text-white">Dean Final Review: Aryan Sharma</h2>
                                        <p className="text-slate-600 dark:text-slate-400 mt-1">ID: PRISM-2024-001 | Program: Semester Abroad (TU Delft, Netherlands) 2024</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm">
                                            <span className="material-symbols-outlined text-lg">download</span> Dossier
                                        </button>
                                        <button className="flex items-center gap-2 px-6 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors">
                                            <span className="material-symbols-outlined text-lg">block</span> Reject Application
                                        </button>
                                        <button className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary hover:bg-green-600 text-white font-bold text-sm transition-colors shadow-lg shadow-primary/20">
                                            <span className="material-symbols-outlined text-lg">check_circle</span> Grant Final Approval
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 flex gap-8">
                                {/* Left Panel */}
                                <div className="flex-[2] flex flex-col gap-6">
                                    {/* Stats */}
                                    <div className="grid grid-cols-4 gap-4">
                                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <p className="text-xs text-slate-500 dark:text-slate-400">CGPA</p>
                                            <p className="text-lg font-bold text-slate-900 dark:text-white">9.42 / 10</p>
                                        </div>
                                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Credits Earned</p>
                                            <p className="text-lg font-bold text-slate-900 dark:text-white">112</p>
                                        </div>
                                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Disciplinary</p>
                                            <p className="text-lg font-bold text-green-600">Clean Record</p>
                                        </div>
                                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Fin. Clearance</p>
                                            <p className="text-lg font-bold text-green-600">Completed</p>
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                <span className="material-symbols-outlined text-primary">analytics</span> Consolidated Review Summary
                                            </h3>
                                            <span className="text-xs text-slate-500 font-medium">Last updated: Today, 10:45 AM</span>
                                        </div>
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                            <div className="p-5 flex gap-6">
                                                <div className="flex flex-col items-center gap-2 min-w-[120px]">
                                                    <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-black uppercase rounded-full border border-green-200 dark:border-green-800 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-xs">verified</span> APPROVED
                                                    </div>
                                                    <div className="size-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                                        <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA187k-QG-6pueFFKTJ3dkf9snGCtIdc6RdUkG4qCVE82hgBKwCecEhbwGeYupzuXyyXQHgK4dCmrIfsiX0_zepFelQJxfoCPqyAnjcs_DIgnZTls3LeUB9WxZBstiDghT56QEh_bdXmh3e8IKFM9vEZwdMdgEh4pOBfdqK_Ek5jKKPzPT-b-kB38QSJ2N29ncW7ez6F1dZ-V-hkYdzr5In_3_A7UjI4oTooERJlaBzv0hJOuDux0eDUnB6DnbP_BkPQ6lY-VGDRg" />
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 font-bold text-center">UG Academics</p>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Dr. Vikram Sahay</h4>
                                                        <p className="text-xs text-slate-400 italic">2 days ago</p>
                                                    </div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                                                        Student meets all prerequisite requirements for TU Delft. The course mapping for 'Data Structures' and 'Signals' has been vetted. CGPA is well above the threshold. Recommendation: Proceed with full approval.
                                                    </p>
                                                </div>
                                            </div>
                                            {/* Repeat for Student Life */}
                                            <div className="p-5 flex gap-6">
                                                <div className="flex flex-col items-center gap-2 min-w-[120px]">
                                                    <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-black uppercase rounded-full border border-green-200 dark:border-green-800 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-xs">verified</span> APPROVED
                                                    </div>
                                                    <div className="size-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                                        <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBNG49i_9JEOK7gOshkiCiGeHvIwlW5fvEMq3nlkr8bhbowdJSg6ytFA9-ss4Pmf3z1Rc2Wt9xg_dbFvifDbtxzGVUjbfx74QI7YPnyDyWTdls2UKLBVFwAQ3Vf5W0uzvYR0Z2NWLf3b1JgoQOQkBKcHjMNTdbM2EkvbK-vUYWQhe4QOs1w0EJKaWkBHeKcHXmZ9gJK2yhZW3B6Zc47jkaLKZb2IRaPZ4MOoxpXuZTit8SDzA1wCVZo4WBmCdUnI8FZgQNVijCS2Q" />
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 font-bold text-center">Student Life</p>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Ms. Ananya Iyer</h4>
                                                        <p className="text-xs text-slate-400 italic">1 day ago</p>
                                                    </div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                                                        Visa documentation support letter has been drafted. Student has completed the cultural sensitivity workshop. No prior housing or behavioral issues reported in the hostel.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Repeat for Program Chair */}
                                            <div className="p-5 flex gap-6">
                                                <div className="flex flex-col items-center gap-2 min-w-[120px]">
                                                    <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-black uppercase rounded-full border border-green-200 dark:border-green-800 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-xs">verified</span> APPROVED
                                                    </div>
                                                    <div className="size-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                                        <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQkewfUP9H7C1YS0IEaLo7nWYbkTppYKrJTIz5svm4SJnLFFTOFcYkdE9x3ZHzdM7Gw-1Dc8NXJYwkIljhFO1l2C4DJraAJtLwbOGGDZsKz9LmDCyCyjn_xnWWhuvJyQGM1-mca_FRmaz8igyblJS-u_ncjq-kaChW9xxemdzsCEapLiv5LGr5rRsuetnaOq26JYx4WcxLqAmXwkHq2f5vAYVteIe13YwfwNJgroQ5JSiFgmIwJrrPK-Fu3oxgrTYVbnM4iquR3Q" />
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 font-bold text-center">Program Chair</p>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Prof. Rajesh Gupta</h4>
                                                        <p className="text-xs text-slate-400 italic">4 hours ago</p>
                                                    </div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                                                        The research focus of the student aligns perfectly with TU Delft's mobility exchange program. This will significantly benefit the student's final year capstone project. Recommended for Dean's final sign-off.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Statement */}
                                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Candidate Motivation Statement</h4>
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border-l-4 border-primary italic text-slate-700 dark:text-slate-300 text-sm leading-loose">
                                            "Studying at TU Delft will allow me to explore advanced robotics modules not currently available on-campus. My goal is to integrate these learnings into the University's Sustainable Tech initiative upon my return..."
                                        </div>
                                        <button className="mt-4 text-primary text-xs font-bold hover:underline flex items-center gap-1">
                                            View Full Application <span className="material-symbols-outlined text-xs">open_in_new</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Right Panel */}
                                <div className="flex-1 flex flex-col gap-6">
                                    {/* Comm History */}
                                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col h-[500px]">
                                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                                                <span className="material-symbols-outlined text-primary text-lg">forum</span> Communication History
                                            </h3>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                                            <div className="flex gap-3">
                                                <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-sm text-slate-500">mail</span>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white">Automated System</p>
                                                    <p className="text-xs text-slate-500">Document Upload: Passport (Valid)</p>
                                                    <p className="text-[10px] text-slate-400 mt-1">Oct 1, 09:12 AM</p>
                                                </div>
                                            </div>
                                            {/* More logs */}
                                        </div>
                                        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
                                            <div className="relative">
                                                <textarea className="w-full rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-primary focus:border-primary resize-none" placeholder="Add a private note or remark..." rows="3"></textarea>
                                                <button className="absolute bottom-2 right-2 p-1.5 bg-primary text-white rounded-md"><span className="material-symbols-outlined text-sm">send</span></button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Card */}
                                    <div className="bg-primary/5 dark:bg-primary/10 p-6 rounded-xl border border-primary/20 flex flex-col gap-4">
                                        <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                                            <span className="material-symbols-outlined">gavel</span> Dean's Final Decision
                                        </h4>
                                        <p className="text-xs text-slate-600 dark:text-slate-400">Your approval will finalize this application and trigger the official acceptance letter for the student.</p>
                                        <div className="flex flex-col gap-3">
                                            <button className="w-full py-3 bg-primary text-white font-bold rounded-lg shadow-lg shadow-primary/30 flex items-center justify-center gap-2 hover:bg-green-600 transition-all">
                                                <span className="material-symbols-outlined">verified</span> Grant Final Approval
                                            </button>
                                            <button className="w-full py-2 bg-transparent text-slate-500 dark:text-slate-400 text-xs font-bold hover:text-red-500 transition-colors">
                                                Hold for Clarification
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
