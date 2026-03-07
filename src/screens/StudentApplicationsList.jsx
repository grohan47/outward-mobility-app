import React from 'react';

export default function StudentApplicationsList() {
    return (
        <div className="max-w-4xl mx-auto py-8">
            <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">Active Applications</h3>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm mb-6">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex gap-4">
                            <div className="size-16 rounded-lg bg-slate-100 overflow-hidden">
                                <img
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDUpjX9pChEJGglFfqoXpy6PymTLlq8yh689rIP3XhBQbPlR7SWOlfI3k0QgxUFLTvoWE2i9Bd-3vSfxTFtKQS4dule54LIfS2icVH2Kl-HUNM5zX8sDvtvkWX_k2IFDuKkf2OSrZjbGVHBRq1BpYve-2dwieWEX6rJAYtqj0vRY1Bu9Q7I32xqf9K3g4JeQw4zmmCBC1smc5whqyQBzJAXgbPJ5eg2cs-x46kmg7zVbCPRUqK2jZzgd8Ag3dqW_CVUWtqUGbSyBw"
                                    alt="NUS"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-slate-900 dark:text-white">National University of Singapore</h4>
                                <p className="text-slate-500 text-sm">Global Exchange Program 2024</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">Under Review</span>
                                    <span className="text-xs text-slate-400">ID: APP-2024-001</span>
                                </div>
                            </div>
                        </div>
                        <button className="text-slate-400 hover:text-primary">
                            <span className="material-symbols-outlined">more_vert</span>
                        </button>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-100 dark:border-slate-800 mb-6">
                        <h5 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Current Status: Program Chair Review</h5>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Your application has passed OGE initial screening and is now being reviewed by the Program Chair for course compatibility. Expected completion: 2 days.
                        </p>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                        <h5 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Application History</h5>
                        <div className="space-y-4">
                            {[
                                { label: 'Submitted Application', date: 'Oct 20, 2023', current: false },
                                { label: 'OGE Screening Passed', date: 'Oct 22, 2023', current: false },
                                { label: 'Program Chair Review', date: 'In Progress', current: true },
                            ].map((item) => (
                                <div key={item.label} className="flex gap-3">
                                    <div className="flex flex-col items-center">
                                        <div className={`size-2 rounded-full ${item.current ? 'border-2 border-primary bg-white dark:bg-slate-900' : 'bg-primary'}`}></div>
                                        {!item.current && <div className="w-0.5 bg-slate-200 dark:bg-slate-800 flex-1 my-1"></div>}
                                    </div>
                                    <div>
                                        <p className={`text-xs font-bold ${item.current ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>{item.label}</p>
                                        <p className="text-[10px] text-slate-400">{item.date}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                    <button className="text-sm text-slate-600 font-medium hover:text-slate-900">Withdraw Application</button>
                    <button className="bg-white border border-slate-300 text-slate-700 text-sm font-bold px-4 py-2 rounded-lg hover:bg-slate-50 shadow-sm">View Full Dossier</button>
                </div>
            </div>
        </div>
    );
}