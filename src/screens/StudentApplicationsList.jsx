import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost } from '../api/client';

const STAGE_LABELS = Object.freeze({
    STUDENT_SUBMISSION: 'Student Submission',
    STUDENT_LIFE: 'Student Life Review',
    PROGRAM_CHAIR: 'Program Chair Review',
    OGE: 'OGE Office Review',
    DEAN: 'Dean of Academics Review',
    CLOSED: 'Closed',
});

function getStageLabel(application) {
    return application.workflow?.stageLabel ?? STAGE_LABELS[application.current_stage] ?? application.current_stage;
}

export default function StudentApplicationsList() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [applications, setApplications] = useState([]);
    const [timelines, setTimelines] = useState({});
    const [actionMessage, setActionMessage] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            // API GET: fetch applications restricted to the current student profile.
            const list = await apiGet('/api/applications?studentProfileId=1');
            const items = list.items ?? [];
            // API GET: fetch per-application detail/timeline for each student application.
            // Why two GET calls: first for list rows, second for detailed timeline blocks.
            const detailPromises = items.map((item) => apiGet(`/api/applications/${item.id}`));
            const details = await Promise.all(detailPromises);
            setApplications(items);
            const timelineMap = {};
            for (const detail of details) {
                timelineMap[detail.application.id] = detail.timeline ?? [];
            }
            setTimelines(timelineMap);
        } catch (err) {
            setError(err.message || 'Failed to load applications.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const activeApplications = useMemo(
        () => applications.filter((application) => !application.final_status),
        [applications]
    );

    async function handleResubmit(applicationId) {
        setActionMessage('');
        try {
            // API POST: resubmit a student application back into review workflow.
            // Student pushes an app back into workflow here.
            await apiPost(`/api/applications/${applicationId}/resubmit`, { actorUserId: 1 });
            setActionMessage(`Application APP-${applicationId} resubmitted to Student Life review.`);
            await loadData();
        } catch (err) {
            setActionMessage(err.message || 'Failed to resubmit application.');
        }
    }

    if (loading) {
        return <div className="max-w-4xl mx-auto py-8 text-slate-500">Loading applications...</div>;
    }

    if (error) {
        return <div className="max-w-4xl mx-auto py-8 text-red-500">{error}</div>;
    }

    if (applications.length === 0) {
        return <div className="max-w-4xl mx-auto py-8 text-slate-500">No application found for this student.</div>;
    }

    return (
        <div className="max-w-4xl mx-auto py-8">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Active Applications</h3>
                <button
                    type="button"
                    onClick={loadData}
                    className="text-xs font-semibold px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                    Refresh
                </button>
            </div>

            {actionMessage && <p className="text-xs text-slate-500 mb-4">{actionMessage}</p>}

            {activeApplications.map((application) => {
                const history = timelines[application.id] ?? [];
                return (
            <div key={application.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm mb-6">
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
                                <h4 className="text-xl font-bold text-slate-900 dark:text-white">{application.opportunity?.destination ?? 'Unknown Destination'}</h4>
                                <p className="text-slate-500 text-sm">{application.opportunity?.title ?? 'Exchange Opportunity'}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">{application.final_status ?? 'Under Review'}</span>
                                    <span className="text-xs text-slate-400">ID: APP-{application.id}</span>
                                </div>
                            </div>
                        </div>
                        <button className="text-slate-400 hover:text-primary">
                            <span className="material-symbols-outlined">more_vert</span>
                        </button>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-100 dark:border-slate-800 mb-6">
                        <h5 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Current Status: {getStageLabel(application)}</h5>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            This application is currently tracked in the integrated SQLite workflow pipeline.
                        </p>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                        <h5 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Application History</h5>
                        <div className="space-y-4">
                            {history.map((event, index) => (
                                <div key={`${event.event_type}-${event.id ?? index}`} className="flex gap-3">
                                    <div className="flex flex-col items-center">
                                        <div className={`size-2 rounded-full ${index === history.length - 1 ? 'border-2 border-primary bg-white dark:bg-slate-900' : 'bg-primary'}`}></div>
                                        {index !== history.length - 1 && <div className="w-0.5 bg-slate-200 dark:bg-slate-800 flex-1 my-1"></div>}
                                    </div>
                                    <div>
                                        <p className={`text-xs font-bold ${index === history.length - 1 ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>{event.event_type}</p>
                                        <p className="text-[10px] text-slate-400">{new Date(event.created_at).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                    {application.current_stage === 'STUDENT_SUBMISSION' && !application.final_status && (
                        <button
                            type="button"
                            onClick={() => handleResubmit(application.id)}
                            className="text-sm text-blue-700 font-medium hover:text-blue-900"
                        >
                            Resubmit to Student Life
                        </button>
                    )}
                    <Link to={`/student/application/${application.id}`} className="bg-white border border-slate-300 text-slate-700 text-sm font-bold px-4 py-2 rounded-lg hover:bg-slate-50 shadow-sm inline-block">View Full Dossier</Link>
                </div>
            </div>
                );
            })}

            {activeApplications.length === 0 && (
                <p className="text-sm text-slate-500">No active applications. Closed applications are excluded from this view.</p>
            )}
        </div>
    );
}