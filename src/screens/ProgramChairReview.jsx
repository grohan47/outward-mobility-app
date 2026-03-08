import React from 'react';
import { useParams } from 'react-router-dom';

export default function ProgramChairReview() {
    const { id } = useParams();

    return (
        <>
                <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 sticky top-0 z-50">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3 text-primary">
                            <div className="size-8">
                                <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                    <path clipRule="evenodd" d="M47.2426 24L24 47.2426L0.757355 24L24 0.757355L47.2426 24ZM12.2426 21H35.7574L24 9.24264L12.2426 21Z" fill="currentColor" fillRule="evenodd"></path>
                                </svg>
                            </div>
                            <h2 className="text-slate-900 dark:text-white text-xl font-bold leading-tight tracking-tight">PRISM</h2>
                        </div>
                        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            <span className="text-slate-500 text-sm font-medium uppercase tracking-wider">Review Mode</span>
                        </div>
                    </div>
                    <div className="flex flex-1 justify-center max-w-xl px-4">
                        <label className="flex w-full flex-col h-10">
                            <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                                <div className="text-slate-400 flex bg-slate-100 dark:bg-slate-800 items-center justify-center pl-4 rounded-l-lg border-r-0">
                                    <span className="material-symbols-outlined">search</span>
                                </div>
                                <input className="form-input flex w-full min-w-0 flex-1 border-none bg-slate-100 dark:bg-slate-800 focus:ring-0 h-full placeholder:text-slate-400 px-4 rounded-r-lg text-sm" placeholder="Search applications, students..." />
                            </div>
                        </label>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="flex items-center justify-center rounded-lg h-10 w-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold leading-none text-slate-900 dark:text-white">Dr. Sarah Jenkins</p>
                                <p className="text-xs text-slate-500 mt-1">Program Chair</p>
                            </div>
                            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border border-slate-200 dark:border-slate-700" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDDOKPnzDiGAdUkfwt5muxyYicKQx7B4qk90HR0gIYygGLZkzT2QKwMIuWhnU7SxBQ_bWjFzDLgyDG8x-yrUGjZXmFCVQTym35BV0FD_0rnNyPIRbS4Iz-s8OPkb6Mhbc51FURKLn-7SwTsTSABnnnu9xancWfXgJjd-jplAJ2rP_GqEpfRkS5Io7iIqQ6DGa-S9Nq81l_JXdV5iwJ2ATUBdaeoSEICV2hPIfmb4o5YWi1skBBh9Xp7uwK_BdwDYi8RlRuMf1zDRA")' }}></div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 flex flex-col">
                    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-6">
                        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div>
                                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                                    <span className="font-mono">APP-{id ?? 'UNKNOWN'}</span>
                                    <span>•</span>
                                    <span>Submitted Oct 24, 2023</span>
                                </div>
                                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Aditya Sharma <span className="text-slate-400 font-light">/ B.Tech Computer Science</span></h1>
                            </div>
                            <div className="flex flex-col gap-2 w-full md:w-96">
                                <div className="flex justify-between items-end">
                                    <span className="text-primary font-bold text-sm uppercase flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">pending_actions</span> Currently with You
                                    </span>
                                    <span className="text-rose-500 font-bold text-sm flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">schedule</span> SLA: 2 Days Left
                                    </span>
                                </div>
                                <div className="relative h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="absolute left-0 top-0 h-full bg-primary rounded-full" style={{ width: '60%' }}></div>
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                                    <span>Submission</span>
                                    <span>OGE Screening</span>
                                    <span className="text-primary">Program Review</span>
                                    <span>Partner Univ</span>
                                    <span>Decision</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col lg:flex-row max-w-[1440px] mx-auto w-full">
                        <div className="flex-1 p-6 space-y-8 overflow-y-auto max-h-[calc(100vh-220px)]">
                            {/* Academic Performance */}
                            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">school</span> Academic Performance
                                    </h3>
                                    <button className="text-primary text-sm font-semibold flex items-center gap-1 hover:underline">
                                        <span className="material-symbols-outlined text-sm">download</span> View Full Transcript
                                    </button>
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="flex flex-col p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                        <span className="text-slate-500 text-xs font-bold uppercase mb-1">Cumulative GPA</span>
                                        <span className="text-3xl font-black text-primary">3.88 / 4.0</span>
                                    </div>
                                    <div className="flex flex-col p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                        <span className="text-slate-500 text-xs font-bold uppercase mb-1">Major GPA</span>
                                        <span className="text-3xl font-black text-slate-900 dark:text-white">3.92</span>
                                    </div>
                                    <div className="flex flex-col p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                        <span className="text-slate-500 text-xs font-bold uppercase mb-1">Standing</span>
                                        <span className="text-xl font-bold text-slate-900 dark:text-white mt-1">Top 5% of Cohort</span>
                                    </div>
                                </div>
                            </section>

                            {/* Course Mapping */}
                            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">sync_alt</span> Course Mapping & Compatibility
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-[10px] font-bold uppercase">
                                            <tr>
                                                <th className="px-6 py-3">Partner Institution Course</th>
                                                <th className="px-6 py-3">Plaksha Equivalent Course</th>
                                                <th className="px-6 py-3">Status</th>
                                                <th className="px-6 py-3">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            <tr>
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-slate-900 dark:text-white">CS421: Advanced Algorithms</p>
                                                    <p className="text-xs text-slate-400">4 Credits | UC Berkeley</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="font-medium text-slate-700 dark:text-slate-300">DSA 301: Design & Analysis of Algorithms</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Pre-Approved</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button className="text-slate-400 hover:text-primary"><span className="material-symbols-outlined">edit_note</span></button>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-slate-900 dark:text-white">ECON102: Behavioral Economics</p>
                                                    <p className="text-xs text-slate-400">3 Credits | UC Berkeley</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="font-medium text-slate-700 dark:text-slate-300">HSS 204: Intro to Behavioral Science</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Review Required</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button className="text-slate-400 hover:text-primary"><span className="material-symbols-outlined">edit_note</span></button>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </div>

                        {/* Right Sidebar - AI Summary & Chat */}
                        <aside className="w-full lg:w-[450px] border-l border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 flex flex-col">
                            <div className="p-4 flex-1 flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-280px)]">
                                {/* AI Summary */}
                                <div className="bg-gradient-to-br from-primary/10 to-blue-500/10 border border-primary/20 rounded-xl p-5 relative overflow-hidden shrink-0">
                                    <div className="absolute top-[-20px] right-[-20px] opacity-10">
                                        <span className="material-symbols-outlined text-8xl text-primary">auto_awesome</span>
                                    </div>
                                    <h4 className="text-primary font-bold text-sm mb-2 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">auto_awesome</span> AI Application Summary
                                    </h4>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                        Strong candidate with high major GPA. Course mapping for <span className="text-slate-900 dark:text-white font-semibold">ECON102</span> is new; suggest checking syllabus overlap. Previous exchange students at Berkeley reported high rigor in CS421.
                                    </p>
                                </div>

                                {/* Chat */}
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                                        <div className="flex flex-col">
                                            <h4 className="text-slate-900 dark:text-white font-bold text-sm">Internal Correspondence</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <select className="text-xs bg-transparent border-none p-0 focus:ring-0 text-slate-500 font-medium cursor-pointer">
                                                    <option>Thread: Application Screening (3 messages)</option>
                                                    <option>Thread: Course Equivalency (0 messages)</option>
                                                    <option>+ Start New Thread</option>
                                                </select>
                                            </div>
                                        </div>
                                        <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold">Relayed via Email</span>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="size-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px]">RK</div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-900 dark:text-white">Rajesh Kumar <span className="text-slate-400 font-normal ml-1">&lt;rajesh.k@university.edu&gt;</span></p>
                                                        <p className="text-[10px] text-slate-400">To: Dr. Sarah Jenkins &lt;sarah.j@university.edu&gt;</p>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] text-slate-400 whitespace-nowrap">10:45 AM</span>
                                            </div>
                                            <div className="pl-9">
                                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">Aditya has already secured a partial scholarship from the partner. Screening clear.</p>
                                            </div>
                                        </div>
                                        <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="size-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">SJ</div>
                                                    <div>
                                                        <p className="text-xs font-bold text-primary">You <span className="text-slate-400 font-normal ml-1">&lt;sarah.j@university.edu&gt;</span></p>
                                                        <p className="text-[10px] text-slate-400">To: Rajesh Kumar</p>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] text-slate-400 whitespace-nowrap">11:15 AM</span>
                                            </div>
                                            <div className="pl-9">
                                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">Reviewing the ECON102 syllabus now. Matches HSS 204 content. Will approve once confirmed.</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Reply Box */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden mt-2 shadow-sm">
                                        <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                                            <div className="flex items-center text-xs gap-2">
                                                <span className="text-slate-400 w-8">To:</span>
                                                <input className="flex-1 bg-transparent border-none p-0 focus:ring-0 text-slate-700 dark:text-slate-300 font-medium" type="text" readOnly value="Rajesh Kumar (OGE)" />
                                            </div>
                                        </div>
                                        <textarea className="w-full bg-transparent border-none p-4 text-sm focus:ring-0 min-h-[100px] text-slate-600 dark:text-slate-400" placeholder="Write a reply..."></textarea>
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                                            <div className="flex gap-2 text-slate-400">
                                                <button className="hover:text-primary"><span className="material-symbols-outlined text-sm">attach_file</span></button>
                                                <button className="hover:text-primary"><span className="material-symbols-outlined text-sm">format_bold</span></button>
                                            </div>
                                            <button className="bg-primary text-white text-xs font-bold px-4 py-1.5 rounded-lg flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">send</span> Send Reply
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-lg mt-auto">
                                <div className="flex flex-col gap-4">
                                    <div className="flex gap-3">
                                        <button className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors">
                                            <span className="material-symbols-outlined">check_circle</span> Approve
                                        </button>
                                        <button className="flex-1 border border-rose-500 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors">
                                            <span className="material-symbols-outlined">flag</span> Flag to OGE
                                        </button>
                                    </div>
                                    <div className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs text-slate-500">
                                        <span className="material-symbols-outlined text-sm">info</span>
                                        <p>Approval will move this application to the <strong>Partner University Review</strong> stage. Use 'Flag' for compliance concerns.</p>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>
                </main>
        </>
    );
}
