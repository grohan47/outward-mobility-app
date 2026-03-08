import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api/client';

function toStudentLifeRows(items) {
    return (items ?? []).map((item, index) => {
        const studentName = item.student_user?.full_name ?? 'Unknown Student';
        const initials = studentName
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

        const submittedAt = item.submitted_at ? new Date(item.submitted_at) : null;
        const submittedLabel = submittedAt ? submittedAt.toLocaleDateString() : 'Pending Submission';

        const ageDays = submittedAt
            ? Math.max(0, Math.floor((Date.now() - submittedAt.getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

        let slaLabel = 'On Track';
        let slaClass = 'bg-primary/10 text-primary';
        if (ageDays >= 10) {
            slaLabel = 'Overdue';
            slaClass = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
        } else if (ageDays >= 7) {
            slaLabel = '2 Days Left';
            slaClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        } else if (ageDays > 0) {
            slaLabel = `${Math.max(1, 7 - ageDays)} Days Left`;
        }

        const appCode = `#SL-${String(item.id ?? index + 1).padStart(4, '0')}`;

        return {
            id: item.id,
            appCode,
            studentName,
            initials,
            university: item.opportunity?.destination ?? 'Unknown University',
            submittedLabel,
            slaLabel,
            slaClass,
        };
    });
}

export default function StudentLifeTaskInbox() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;

        async function loadApplications() {
            setLoading(true);
            setError('');
            try {
                const data = await apiGet('/api/applications');
                if (mounted) {
                    setItems(data.items ?? []);
                }
            } catch (err) {
                if (mounted) {
                    setError(err.message || 'Failed to load applications');
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadApplications();
        return () => {
            mounted = false;
        };
    }, []);

    const rows = useMemo(() => toStudentLifeRows(items), [items]);

    return (
        <>
                <header className="flex h-16 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-8 shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
                                <span className="material-symbols-outlined">diamond</span>
                            </div>
                            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 uppercase">PRISM</h2>
                        </div>
                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
                        <label className="relative hidden md:flex w-64 items-center">
                            <span className="material-symbols-outlined absolute left-3 text-slate-400">search</span>
                            <input className="h-10 w-full rounded-lg border-none bg-slate-100 dark:bg-slate-800 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/50" placeholder="Search applications..." type="text" />
                        </label>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800"></div>
                    </div>
                </header>

                <div className="flex flex-1 overflow-hidden">
                    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hidden lg:flex flex-col p-4 shrink-0">
                        <div className="mb-8">
                            <p className="px-3 text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Navigation</p>
                            <nav className="space-y-1">
                                <a className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-colors" href="#">
                                    <span className="material-symbols-outlined">dashboard</span>
                                    Master View
                                </a>
                                <a className="flex items-center gap-3 rounded-lg bg-primary text-white px-3 py-2 text-sm font-medium shadow-md shadow-primary/20" href="#">
                                    <span className="material-symbols-outlined">inbox</span>
                                    Task Inbox
                                </a>
                            </nav>
                        </div>
                        <div className="mt-auto p-4 rounded-xl bg-primary/5 border border-primary/10">
                            <p className="text-xs font-semibold text-primary uppercase mb-1">Status Summary</p>
                            <div className="flex justify-between items-center text-sm mb-2">
                                <span className="text-slate-600 dark:text-slate-300">Pending</span>
                                <span className="font-bold">{rows.length}</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-primary h-full" style={{ width: rows.length > 0 ? '66%' : '0%' }}></div>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 italic">Click any application to open Student Life review.</p>
                        </div>
                    </aside>

                    <main className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark p-4 md:p-8">
                        <div className="max-w-6xl mx-auto">
                            <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                                <div>
                                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">Task Inbox</h1>
                                    <p className="text-slate-500 mt-1">All applications pending Student Life review.</p>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                                {loading && <div className="px-6 py-4 text-sm text-slate-500">Loading applications...</div>}
                                {error && <div className="px-6 py-4 text-sm text-red-500">{error}</div>}
                                {!loading && !error && (
                                    <>
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider">App ID</th>
                                                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Student Name</th>
                                                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Target University</th>
                                                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Date Submitted</th>
                                                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider">SLA Status</th>
                                                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {rows.map((row) => (
                                                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                        <td className="px-6 py-4 text-sm font-medium text-slate-400 font-mono">{row.appCode}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                                                                    {row.initials}
                                                                </div>
                                                                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{row.studentName}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{row.university}</td>
                                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{row.submittedLabel}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${row.slaClass}`}>
                                                                {row.slaLabel}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <Link to={`/student-life/${row.id}`} className="rounded-lg bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-all inline-block">
                                                                Review
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {rows.length === 0 && (
                                                    <tr>
                                                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                                                            No applications found.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-t border-slate-200 dark:border-slate-800">
                                            <p className="text-xs text-slate-500">
                                                Showing <span className="font-bold text-slate-700 dark:text-slate-300">{rows.length}</span> results
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </main>
                </div>
        </>
    );
}
