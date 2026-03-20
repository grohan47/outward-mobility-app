import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet, apiPost } from '../api/client';

const navSections = [
    { id: 'personal', label: 'Personal Information' },
    { id: 'academic', label: 'Academic Records' },
    { id: 'exchange', label: 'Exchange Preferences' },
    { id: 'documents', label: 'Essay & Docs' },
];

export default function OGEApplicationReview() {
    // Review page knows which application to open via route param ':id'.
    const { id } = useParams();
    const [activeSection, setActiveSection] = useState('personal');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [appData, setAppData] = useState(null);
    const [actionMessage, setActionMessage] = useState('');
    const [commentText, setCommentText] = useState('');
    const [commentLoading, setCommentLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            setError('');
            try {
                // API GET: load full application detail for the selected application id.
                const data = await apiGet(`/api/applications/${id}`);
                if (mounted) {
                    // appData includes application, student, opportunity, reviews, decisions, timeline, workflow.
                    setAppData(data);
                }
            } catch (err) {
                if (mounted) {
                    setError(err.message || 'Failed to load application');
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
    }, [id]);

    async function submitComment() {
        setCommentLoading(true);
        try {
            await apiPost('/api/remarks', {
                applicationId: Number(id),
                remarkType: 'COMMENT',
                text: commentText,
                visibilityScope: 'INTERNAL',
                createdBy: 99, // Replace with actual reviewer user id
            });
            setCommentText('');
            // Reload application data to show new comment
            const refreshed = await apiGet(`/api/applications/${id}`);
            setAppData(refreshed);
        } catch (err) {
            setActionMessage(err.message || 'Failed to submit comment');
        } finally {
            setCommentLoading(false);
        }
    }

    async function submitDecision(decision) {
        try {
            // TEMP API MAP (buttons: Flag/Reject/Approve): POST /api/reviews/submit
            // This function is where OGE approve/reject updates workflow stage.
            // API POST: submit OGE decision/review action for this application.
            const response = await apiPost('/api/reviews/submit', {
                applicationId: Number(id),
                reviewerUserId: 99,
                reviewerRole: 'OGE',
                decision,
                remarks: `OGE ${decision.toLowerCase()} action from review screen.`,
                visibilityScope: 'INTERNAL',
            });
            setActionMessage(`Decision recorded: ${decision}`);
            // API GET: reload latest application state after decision submission.
            // Refetch after POST to render updated stage/status from server state.
            const refreshed = await apiGet(`/api/applications/${response.application.id}`);
            setAppData(refreshed);
        } catch (err) {
            setActionMessage(err.message || 'Failed to submit decision');
        }
    }

    function scrollToSection(sectionId) {
        setActiveSection(sectionId);
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }

    if (loading) {
        return <div className="p-6 text-slate-500">Loading application review...</div>;
    }

    if (error) {
        return <div className="p-6 text-red-500">{error}</div>;
    }

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50 dark:bg-slate-950 -mx-10 -mb-10">
            <aside className="w-64 shrink-0 overflow-y-auto border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 px-4 hidden lg:block">
                <h3 className="px-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Review Navigation</h3>
                <nav className="space-y-1">
                    {navSections.map((section) => {
                        const active = activeSection === section.id;

                        return (
                            // TEMP API MAP (button: review section jump): no API call, local scroll only.
                            <button
                                key={section.id}
                                type="button"
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    active
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                                onClick={() => scrollToSection(section.id)}
                            >
                                {section.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="mt-8 px-2">
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-xl">
                        <h4 className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase mb-2">Flagged Items</h4>
                        <ul className="text-xs space-y-2 text-slate-700 dark:text-slate-300">
                            <li className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-sm text-orange-500">warning</span>
                                Document scan quality low
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-sm text-orange-500">warning</span>
                                SOP word count low
                            </li>
                        </ul>
                    </div>
                </div>
            </aside>

            <div className="flex-1 overflow-y-auto scroll-smooth relative">
                <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-primary/20 px-6 py-4">
                    <div className="max-w-3xl mx-auto">
                        <div className="flex gap-4 items-start">
                            <div className="size-10 rounded-lg bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                                <span className="material-symbols-outlined text-white">auto_awesome</span>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    AI Application Insight
                                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] font-bold uppercase">
                                        Strong Match
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                                    Candidate shows clear academic alignment with TU Delft&apos;s program. Current CGPA (9.42) exceeds requirement (8.0). SOP demonstrates specific research interest.
                                    <span className="font-bold text-slate-700 dark:text-slate-200"> Attention:</span> Verify course equivalence for &apos;Advanced Robotics&apos; as it&apos;s a new mapping.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto py-8 px-6 space-y-10">
                                        {/* Comments Section */}
                                        <section className="mb-10">
                                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                                <span className="flex items-center justify-center size-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500">💬</span>
                                                Reviewer Comments
                                            </h2>
                                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
                                                <div className="space-y-4">
                                                    {(appData?.remarks ?? []).length === 0 && <p className="text-sm text-slate-500">No comments yet.</p>}
                                                    {(appData?.remarks ?? []).map((remark) => (
                                                        <div key={remark.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="material-symbols-outlined text-slate-400">chat</span>
                                                                <span className="text-xs text-slate-500">{new Date(remark.created_at).toLocaleString()}</span>
                                                            </div>
                                                            <div className="text-sm text-slate-900 dark:text-white">{remark.text}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex gap-2 mt-4">
                                                    <input
                                                        type="text"
                                                        value={commentText}
                                                        onChange={e => setCommentText(e.target.value)}
                                                        placeholder="Add a comment..."
                                                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                                                        disabled={commentLoading}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={submitComment}
                                                        className="px-4 py-2 rounded-lg bg-primary text-white font-bold text-sm hover:bg-green-600 transition-colors"
                                                        disabled={commentLoading || !commentText.trim()}
                                                    >
                                                        {commentLoading ? 'Posting...' : 'Post'}
                                                    </button>
                                                </div>
                                            </div>
                                        </section>
                    <header className="flex items-center justify-between pb-2">
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 dark:text-white">{appData?.student_user?.full_name ?? 'Unknown Student'}</h1>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">Application #{appData?.application?.id} • {appData?.student_profile?.program ?? 'Program N/A'}</p>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-bold uppercase tracking-wide border border-blue-200 dark:border-blue-800">
                            {appData?.workflow?.stageLabel ?? appData?.application?.current_stage ?? 'Submitted'}
                        </div>
                    </header>

                    <section id="personal" className="scroll-mt-32">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="flex items-center justify-center size-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500">1</span>
                            Personal Information
                        </h2>
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6 opacity-80 pointer-events-none grayscale-[0.5]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Full Legal Name</label>
                                    <input type="text" value="Arjun Sharma" readOnly className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Student ID</label>
                                    <input type="text" value="PL-2022-042" readOnly className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white sm:text-sm" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">University Email</label>
                                    <input type="email" value="arjun.sharma@plaksha.edu.in" readOnly className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Phone Number</label>
                                    <input type="tel" value="+91 99999 99999" readOnly className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white sm:text-sm" />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section id="academic" className="scroll-mt-32">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="flex items-center justify-center size-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500">2</span>
                            Academic Records
                        </h2>
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6 opacity-80 pointer-events-none grayscale-[0.5]">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Current CGPA</label>
                                    <input type="text" value="9.42" readOnly className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Current Semester</label>
                                    <input type="text" value="Semester 4" readOnly className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Major</label>
                                    <input type="text" value="Computer Science" readOnly className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white sm:text-sm" />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section id="exchange" className="scroll-mt-32">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="flex items-center justify-center size-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500">3</span>
                            Exchange Preferences
                        </h2>
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Target University</label>
                                <div className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-white text-sm font-bold flex items-center justify-between">
                                    TU Delft (Netherlands)
                                    <span className="text-xs font-normal text-slate-500">1st Choice</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Proposed Course Mapping</label>
                                <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                                            <tr>
                                                <th className="px-4 py-3">Course Code (Host)</th>
                                                <th className="px-4 py-3">Course Title (Host)</th>
                                                <th className="px-4 py-3">Equivalent Course (Plaksha)</th>
                                                <th className="px-4 py-3 w-24">Verified?</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            <tr>
                                                <td className="p-3 text-slate-900 dark:text-white">CS101</td>
                                                <td className="p-3 text-slate-900 dark:text-white">Intro to CS</td>
                                                <td className="p-3 text-slate-900 dark:text-white">COMP 101</td>
                                                <td className="p-3"><span className="material-symbols-outlined text-green-500">check_circle</span></td>
                                            </tr>
                                            <tr>
                                                <td className="p-3 text-slate-900 dark:text-white">ECON 202</td>
                                                <td className="p-3 text-slate-900 dark:text-white">Microeconomics</td>
                                                <td className="p-3 text-slate-900 dark:text-white">ECON 101</td>
                                                <td className="p-3"><span className="material-symbols-outlined text-slate-300">remove</span></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section id="documents" className="scroll-mt-32">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="flex items-center justify-center size-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500">4</span>
                            Documents &amp; Essays
                        </h2>
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Statement of Purpose</label>
                                <div className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                    I have always been fascinated by the intersection of robotics and sustainable design. TU Delft&apos;s renowned program in...
                                    <span className="text-xs text-slate-400 font-bold"> [Read More]</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    { title: 'Transcripts.pdf', details: '4.2 MB • Uploaded Oct 2', tint: 'bg-red-100 text-red-600' },
                                    { title: 'Resume_Final.pdf', details: '1.8 MB • Uploaded Oct 2', tint: 'bg-blue-100 text-blue-600' },
                                ].map((item) => (
                                    <div key={item.title} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group">
                                        <div className={`size-10 rounded-lg flex items-center justify-center ${item.tint}`}>
                                            <span className="material-symbols-outlined">description</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</p>
                                            <p className="text-xs text-slate-500">{item.details}</p>
                                        </div>
                                        <span className="material-symbols-outlined ml-auto text-slate-400 group-hover:text-primary">download</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <div className="h-16"></div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 z-40 lg:pl-64">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <p className="text-xs text-slate-500">Review status: <span className="font-bold text-blue-600">{appData?.application?.final_status ?? `Pending with ${appData?.workflow?.currentStakeholder ?? 'Reviewer'}`}</span></p>
                    <div className="flex gap-3">
                        {/* TEMP API MAP (button: Request Clarification): pending API, suggested POST /api/applications/:id/actions/clarify */}
                        <button className="px-5 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">chat</span>
                            Request Clarification
                        </button>
                        {/* TEMP API MAP (button: Flag to Student): POST /api/reviews/submit (future explicit: POST /api/applications/:id/actions/flag) */}
                        <button type="button" onClick={() => submitDecision('FLAG')} className="px-5 py-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 font-bold text-sm hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">flag</span>
                            Flag to Student
                        </button>
                        {/* TEMP API MAP (button: Reject): POST /api/reviews/submit (future explicit: POST /api/applications/:id/actions/reject) */}
                        <button type="button" onClick={() => submitDecision('REJECT')} className="px-5 py-2.5 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">block</span>
                            Reject
                        </button>
                        {/* TEMP API MAP (button: Approve for Next Stage): POST /api/reviews/submit (future explicit: POST /api/applications/:id/actions/approve) */}
                        <button type="button" onClick={() => submitDecision('APPROVE')} className="px-5 py-2.5 rounded-lg bg-primary text-white font-bold text-sm hover:bg-green-600 transition-colors shadow-lg shadow-primary/20 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                            Approve for Next Stage
                        </button>
                    </div>
                </div>
                {actionMessage && <p className="max-w-3xl mx-auto mt-2 text-xs text-slate-500">{actionMessage}</p>}
            </div>
        </div>
    );
}