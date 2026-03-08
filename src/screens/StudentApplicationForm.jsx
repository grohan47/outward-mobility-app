import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiPost } from '../api/client';

const sectionOrder = ['personal', 'academic', 'exchange', 'documents'];

const universityOptions = [
    'UC Berkeley',
    'Purdue University',
    'TU Delft',
    'University of Toronto',
    'ETH Zurich',
    'Stanford University',
    'National University of Singapore',
    'Georgia Institute of Technology',
];

const initialMessages = [
    {
        id: 1,
        sender: 'OGE Office',
        text: 'Please upload a clearer copy of your Semester 3 Marksheet.',
        time: '2 days ago',
        isMe: false,
    },
    {
        id: 2,
        sender: 'You',
        text: 'Sure, I have uploaded the new scan in the Documents section.',
        time: '1 day ago',
        isMe: true,
    },
];

const initialCourseRows = [
    {
        id: 1,
        hostCode: 'CS101',
        hostTitle: 'Intro to CS',
        plakshaEquivalent: 'COMP 101',
    },
];

export default function StudentApplicationForm() {
    // Which application is opened: route param ':id' drives this screen mode.
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Form mode is route-driven. '/student/application/new' shows Submit flow.
    const isNew = id === 'new';
    const isDraft = id === 'draft';

    const targetUniversity = useMemo(() => {
        // How university is prefilled for new applications.
        // Answer: from query string `?university=...` when opening '/student/application/new'.
        if (isNew) {
            return searchParams.get('university') || '';
        }

        if (isDraft) {
            return 'Georgia Institute of Technology';
        }

        return 'National University of Singapore';
    }, [isDraft, isNew, searchParams]);

    const [activeSection, setActiveSection] = useState('personal');
    const [showChat, setShowChat] = useState(!isNew && !isDraft);
    const [submitting, setSubmitting] = useState(false);
    const [submitMessage, setSubmitMessage] = useState('');
    const [chatMessages, setChatMessages] = useState(initialMessages);
    const [newMessage, setNewMessage] = useState('');
    const [courseRows, setCourseRows] = useState(initialCourseRows);
    const [formData, setFormData] = useState({
        fullName: 'Arjun Sharma',
        studentId: 'PL-2022-042',
        universityEmail: 'arjun.sharma@plaksha.edu.in',
        phone: isNew ? '' : '+91 99999 99999',
        cgpa: isNew ? '' : '9.42',
        semester: 'Semester 4',
        major: 'Computer Science',
        university: targetUniversity,
        sop: '',
    });

    const completion = isNew ? '10%' : '45%';
    const wordCount = formData.sop.trim() ? formData.sop.trim().split(/\s+/).length : 0;

    function updateField(field, value) {
        setFormData((current) => ({ ...current, [field]: value }));
    }

    function updateCourseRow(rowId, field, value) {
        setCourseRows((current) => current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
    }

    function addCourseRow() {
        setCourseRows((current) => [
            ...current,
            {
                id: Date.now(),
                hostCode: '',
                hostTitle: '',
                plakshaEquivalent: '',
            },
        ]);
    }

    function deleteCourseRow(rowId) {
        setCourseRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== rowId)));
    }

    function scrollToSection(sectionId) {
        setActiveSection(sectionId);
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }

    function sendMessage() {
        if (!newMessage.trim()) {
            return;
        }

        setChatMessages((current) => [
            ...current,
            {
                id: Date.now(),
                sender: 'You',
                text: newMessage,
                time: 'Just now',
                isMe: true,
            },
        ]);
        setNewMessage('');
    }

    async function handleSubmitApplication() {
        // Student submission starts in this handler.
        // TEMP API MAP (button: Submit): POST /api/applications
        setSubmitting(true);
        setSubmitMessage('');
        try {
            if (!formData.university?.trim()) {
                throw new Error('Please select a target university.');
            }
            // API POST: create a new application for the current student profile.
            await apiPost('/api/applications', {
                studentProfileId: 1,
                universityName: formData.university,
            });
            // After successful submit, student is redirected to application list.
            setSubmitMessage('Application submitted successfully. Redirecting...');
            setTimeout(() => {
                navigate('/student/applications');
            }, 400);
        } catch (error) {
            setSubmitMessage(error.message || 'Failed to submit application.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50 dark:bg-slate-950 -mx-8 -mb-8">
            <aside className="w-64 shrink-0 overflow-y-auto border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 px-4 hidden lg:block">
                <h3 className="px-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Application Sections</h3>
                <nav className="space-y-1">
                    {sectionOrder.map((section) => {
                        const label = section === 'documents' ? 'documents & essays' : `${section} information`;
                        const active = activeSection === section;

                        return (
                            // TEMP API MAP (button: left nav section): no API call, local scroll only.
                            <button
                                key={section}
                                type="button"
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                                    active
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                                onClick={() => scrollToSection(section)}
                            >
                                {label}
                            </button>
                        );
                    })}
                </nav>

                <div className="mt-8 px-2">
                    <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Completion</p>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2">
                            <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: completion }}></div>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{completion} Completed</p>
                    </div>
                </div>
            </aside>

            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 overflow-y-auto scroll-smooth">
                    <div className="max-w-3xl mx-auto py-8 px-6 space-y-10">
                        <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
                            <div>
                                <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                                    {isNew ? 'New Application' : 'Semester Exchange Application'}
                                </h1>
                                <p className="text-slate-500 dark:text-slate-400 mt-1">
                                    Fall 2024 • {isNew ? 'Drafting...' : 'Application #APP-2024-001'}
                                </p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                                isNew || isDraft
                                    ? 'bg-slate-100 text-slate-700 border-slate-200'
                                    : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                            }`}>
                                {isNew || isDraft ? 'Draft' : 'Submitted'}
                            </div>
                        </header>

                        <section id="personal" className="scroll-mt-6">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <span className="flex items-center justify-center size-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500">1</span>
                                Personal Information
                            </h2>
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Full Legal Name</label>
                                        <input
                                            type="text"
                                            value={formData.fullName}
                                            onChange={(event) => updateField('fullName', event.target.value)}
                                            className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary sm:text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Student ID</label>
                                        <input
                                            type="text"
                                            value={formData.studentId}
                                            readOnly
                                            className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 focus:ring-primary focus:border-primary sm:text-sm cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">University Email</label>
                                        <input
                                            type="email"
                                            value={formData.universityEmail}
                                            readOnly
                                            className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 focus:ring-primary focus:border-primary sm:text-sm cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Phone Number</label>
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(event) => updateField('phone', event.target.value)}
                                            placeholder="+91 99999 99999"
                                            className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary sm:text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section id="academic" className="scroll-mt-6">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <span className="flex items-center justify-center size-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500">2</span>
                                Academic Records
                            </h2>
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Current CGPA</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.cgpa}
                                            onChange={(event) => updateField('cgpa', event.target.value)}
                                            placeholder="0.00"
                                            className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary sm:text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Current Semester</label>
                                        <select
                                            value={formData.semester}
                                            onChange={(event) => updateField('semester', event.target.value)}
                                            className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary sm:text-sm"
                                        >
                                            <option>Semester 4</option>
                                            <option>Semester 5</option>
                                            <option>Semester 6</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Major</label>
                                        <select
                                            value={formData.major}
                                            onChange={(event) => updateField('major', event.target.value)}
                                            className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary sm:text-sm"
                                        >
                                            <option>Computer Science</option>
                                            <option>Robotics</option>
                                            <option>Biological Systems</option>
                                            <option>Data Science</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section id="exchange" className="scroll-mt-6">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <span className="flex items-center justify-center size-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500">3</span>
                                Exchange Preferences
                            </h2>
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Target University</label>
                                    <select
                                        value={formData.university}
                                        onChange={(event) => updateField('university', event.target.value)}
                                        className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary sm:text-sm"
                                    >
                                        <option value="" disabled>Select a Partner University</option>
                                        {universityOptions.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Proposed Course Mapping</label>
                                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                                                <tr>
                                                    <th className="px-4 py-3">Course Code (Host)</th>
                                                    <th className="px-4 py-3">Course Title (Host)</th>
                                                    <th className="px-4 py-3">Equivalent (Plaksha)</th>
                                                    <th className="px-4 py-3 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {courseRows.map((row) => (
                                                    <tr key={row.id}>
                                                        <td className="p-2">
                                                            <input
                                                                type="text"
                                                                value={row.hostCode}
                                                                onChange={(event) => updateCourseRow(row.id, 'hostCode', event.target.value)}
                                                                placeholder="CS101"
                                                                className="w-full border-none bg-transparent focus:ring-0 p-2 placeholder:text-slate-400"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <input
                                                                type="text"
                                                                value={row.hostTitle}
                                                                onChange={(event) => updateCourseRow(row.id, 'hostTitle', event.target.value)}
                                                                placeholder="Intro to CS"
                                                                className="w-full border-none bg-transparent focus:ring-0 p-2 placeholder:text-slate-400"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <input
                                                                type="text"
                                                                value={row.plakshaEquivalent}
                                                                onChange={(event) => updateCourseRow(row.id, 'plakshaEquivalent', event.target.value)}
                                                                placeholder="COMP 101"
                                                                className="w-full border-none bg-transparent focus:ring-0 p-2 placeholder:text-slate-400"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-center text-slate-400 hover:text-red-500 cursor-pointer">
                                                            <button type="button" onClick={() => deleteCourseRow(row.id)}>
                                                                <span className="material-symbols-outlined text-base">delete</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <button
                                            type="button"
                                            onClick={addCourseRow}
                                            className="w-full py-2 bg-slate-50 dark:bg-slate-800/50 text-primary text-xs font-bold uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-t border-slate-200 dark:border-slate-800"
                                        >
                                            + Add Course Row
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section id="documents" className="scroll-mt-6">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <span className="flex items-center justify-center size-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500">4</span>
                                Documents &amp; Essays
                            </h2>
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Statement of Purpose</label>
                                    <textarea
                                        rows="6"
                                        value={formData.sop}
                                        onChange={(event) => updateField('sop', event.target.value)}
                                        className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary sm:text-sm"
                                        placeholder="Why do you want to join this program? (Max 500 words)"
                                    ></textarea>
                                    <p className="text-xs text-slate-500 mt-2 text-right">{wordCount} / 500 words</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {[
                                        { title: 'Transcripts', subtitle: 'PDF up to 5MB' },
                                        { title: 'CV / Resume', subtitle: 'PDF up to 2MB' },
                                    ].map((item) => (
                                        <div key={item.title} className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                                            <span className="material-symbols-outlined text-4xl text-slate-300 group-hover:text-primary transition-colors">upload_file</span>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white mt-3">{item.title}</p>
                                            <p className="text-xs text-slate-500 mt-1">{item.subtitle}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <div className="h-16"></div>
                    </div>
                </div>

                {showChat && (
                    <aside className="w-80 shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shadow-xl z-20 fixed inset-y-0 right-0 pt-16 xl:pt-0 xl:static">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm">App Correspondence</h3>
                            <button
                                type="button"
                                className="size-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 cursor-pointer hover:bg-slate-200 transition-colors"
                                title="Close Chat"
                                onClick={() => setShowChat(false)}
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/50">
                            {chatMessages.map((message) => (
                                <div key={message.id} className={`flex flex-col ${message.isMe ? 'items-end' : 'items-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-xs ${
                                        message.isMe
                                            ? 'bg-primary text-white rounded-br-none'
                                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-bl-none shadow-sm'
                                    }`}>
                                        {message.text}
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-1 px-1">{message.sender} • {message.time}</span>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(event) => setNewMessage(event.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-primary focus:border-primary"
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            sendMessage();
                                        }
                                    }}
                                />
                                <button type="button" className="p-2 rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors" onClick={sendMessage}>
                                    <span className="material-symbols-outlined text-sm">send</span>
                                </button>
                            </div>
                        </div>
                    </aside>
                )}
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 z-40 lg:pl-64">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <p className="text-xs text-slate-500">{isNew ? 'Draft saved just now' : 'Last saved: Oct 24, 10:42 AM'}</p>
                    <div className="flex gap-3">
                        {!isNew && (
                            <button
                                type="button"
                                className="xl:hidden px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm bg-slate-50 dark:bg-slate-800 flex items-center gap-2"
                                onClick={() => setShowChat((current) => !current)}
                            >
                                <span className="material-symbols-outlined text-sm">chat</span>
                                {showChat ? 'Hide Chat' : 'Show Chat'}
                            </button>
                        )}
                        {/* TEMP API MAP (button: Save Draft/Update): pending API, suggested PATCH /api/applications/:id */}
                        <button className="px-6 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            {isNew ? 'Save Draft' : 'Update Application'}
                        </button>
                        {isNew && (
                            <button
                                type="button"
                                // TEMP API MAP (button: Submit): POST /api/applications
                                onClick={handleSubmitApplication}
                                disabled={submitting}
                                className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold text-sm hover:bg-green-600 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
                            >
                                {submitting ? 'Submitting...' : 'Submit'}
                            </button>
                        )}
                    </div>
                </div>
                {submitMessage && (
                    <p className="max-w-3xl mx-auto mt-2 text-xs text-slate-500">{submitMessage}</p>
                )}
            </div>
        </div>
    );
}