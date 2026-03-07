import React from 'react';

export default function OGEMasterDashboard() {
    return (
        <>
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
            <div className="flex flex-wrap gap-3 mb-6 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                {['University: All', 'Status: Active', 'Priority: High', 'SLA: Near Breach'].map((label) => (
                    <button key={label} className="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <span>{label}</span>
                        <span className="material-symbols-outlined text-lg">expand_more</span>
                    </button>
                ))}
                <div className="flex-1"></div>
                <button className="flex items-center gap-2 px-4 py-2 text-slate-500 text-sm font-medium hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-lg">filter_alt_off</span>
                    Clear Filters
                </button>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Student Name</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Target University</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Current Stage &amp; Progress</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Time Remaining</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Flags</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {[
                                { student: 'Arjun Sharma', initials: 'AS', id: 'PL-2024-001', university: 'UC Berkeley', stage: 'Student Life Review', stageColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', progress: 2, timeColor: 'bg-red-500', timeLabel: '1 Day Left', timeClass: 'text-red-600', flags: ['description', 'priority_high'], width: '85%' },
                                { student: 'Meera Kapoor', initials: 'MK', id: 'PL-2024-042', university: 'UPenn', stage: 'Academic Verification', stageColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', progress: 1, timeColor: 'bg-orange-400', timeLabel: '3 Days Left', timeClass: 'text-orange-500', flags: ['remove_circle_outline'], width: '60%' },
                            ].map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">{row.initials}</div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-slate-900 dark:text-white">{row.student}</span>
                                                <span className="text-[10px] text-slate-500">ID: {row.id}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">{row.university}</span></td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col gap-2">
                                            <span className={`inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-medium ${row.stageColor}`}>{row.stage}</span>
                                            <div className="flex gap-1 w-24">
                                                {Array.from({ length: 5 }).map((_, index) => (
                                                    <div key={`${row.id}-${index}`} className={`h-1 flex-1 rounded-full ${index < row.progress ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                                ))}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div className={`h-full ${row.timeColor}`} style={{ width: row.width }}></div>
                                            </div>
                                            <span className={`text-xs font-bold ${row.timeClass}`}>{row.timeLabel}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex gap-1">
                                            {row.flags.map((flag) => (
                                                <span key={`${row.id}-${flag}`} className={`material-symbols-outlined text-base ${flag === 'priority_high' ? 'text-red-500' : flag === 'description' ? 'text-orange-500' : 'text-slate-300'}`}>{flag}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                        <button className="text-slate-400 hover:text-primary transition-colors"><span className="material-symbols-outlined">more_vert</span></button>
                                    </td>
                                </tr>
                            ))}
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
        </>
    );
}
