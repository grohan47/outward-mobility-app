import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api/client';

function mapRows(items) {
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

        const stageCode = item.current_stage ?? 'STUDENT_SUBMISSION';
        let queue = 'General Queue';
        if (stageCode === 'PROGRAM_CHAIR') {
            queue = 'Program Chair Queue';
        } else if (stageCode === 'STUDENT_LIFE') {
            queue = 'Awaiting Student Life';
        } else if (stageCode === 'OGE' || stageCode === 'DEAN') {
            queue = 'Post Chair Stages';
        }

        const appCode = `#PC-${String(item.id ?? index + 1).padStart(4, '0')}`;

        return {
            id: item.id,
            appCode,
            studentName,
            initials,
            university: item.opportunity?.destination ?? 'Unknown University',
            submittedLabel,
            queue,
            queueClass:
                queue === 'Program Chair Queue'
                    ? 'bg-primary/10 text-primary'
                    : queue === 'Awaiting Student Life'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        };
    });
}

export default function ProgramChairTaskInbox() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;

        async function load() {
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

        load();
        return () => {
            mounted = false;
        };
    }, []);

    const rows = useMemo(() => mapRows(items), [items]);

    return (
        <>
                <header className="flex h-16 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-8 shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3 text-primary">
                            <div className="size-8">
                                <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                    <path clipRule="evenodd" d="M47.2426 24L24 47.2426L0.757355 24L24 0.757355L47.2426 24ZM12.2426 21H35.7574L24 9.24264L12.2426 21Z" fill="currentColor" fillRule="evenodd"></path>
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">PRISM</h2>
                        </div>
                        <label className="relative hidden md:flex w-72 items-center">
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

                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">Program Chair Inbox</h1>
                                <p className="text-slate-500 mt-1">Open any application to continue Program Chair review.</p>
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
                                                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Queue</th>
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
                                                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${row.queueClass}`}>
                                                            {row.queue}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <Link to={`/program-chair/${row.id}`} className="rounded-lg bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-all inline-block">
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
        </>
    );
}
