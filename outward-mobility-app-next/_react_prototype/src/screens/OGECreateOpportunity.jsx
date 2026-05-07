import React, { useState } from 'react';

const INITIAL_FORM = {
    code: '',
    title: '',
    destination: '',
    term: '',
    seats: '',
    notes: '',
};

export default function OGECreateOpportunity() {
    const [form, setForm] = useState(INITIAL_FORM);
    const [message, setMessage] = useState('');

    function updateField(event) {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    }

    function handleSubmit(event) {
        event.preventDefault();
        setMessage('');

        if (!form.title.trim() || !form.destination.trim() || !form.term.trim()) {
            setMessage('Please fill title, destination, and term.');
            return;
        }

        // This is intentionally frontend-only for now.
        // Future wiring point: POST /api/opportunities (not implemented yet).
        setMessage('Opportunity created (dummy frontend).');
        setForm(INITIAL_FORM);
    }

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Create New Opportunity</h1>
                <p className="text-slate-500 mt-1">Add a new exchange opportunity for students.</p>
            </div>

            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                        <span className="text-xs font-semibold text-slate-600 mb-1 block">Opportunity Code</span>
                        <input
                            name="code"
                            value={form.code}
                            onChange={updateField}
                            className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm"
                            placeholder="ETH_2026"
                        />
                    </label>
                    <label className="block">
                        <span className="text-xs font-semibold text-slate-600 mb-1 block">Term</span>
                        <input
                            name="term"
                            value={form.term}
                            onChange={updateField}
                            className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm"
                            placeholder="Fall 2026"
                            required
                        />
                    </label>
                </div>

                <label className="block">
                    <span className="text-xs font-semibold text-slate-600 mb-1 block">Title</span>
                    <input
                        name="title"
                        value={form.title}
                        onChange={updateField}
                        className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm"
                        placeholder="ETH Zurich Semester Exchange"
                        required
                    />
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                        <span className="text-xs font-semibold text-slate-600 mb-1 block">Destination University</span>
                        <input
                            name="destination"
                            value={form.destination}
                            onChange={updateField}
                            className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm"
                            placeholder="ETH Zurich"
                            required
                        />
                    </label>
                    <label className="block">
                        <span className="text-xs font-semibold text-slate-600 mb-1 block">Available Seats</span>
                        <input
                            name="seats"
                            value={form.seats}
                            onChange={updateField}
                            className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm"
                            placeholder="20"
                            type="number"
                            min="1"
                        />
                    </label>
                </div>

                <label className="block">
                    <span className="text-xs font-semibold text-slate-600 mb-1 block">Notes</span>
                    <textarea
                        name="notes"
                        value={form.notes}
                        onChange={updateField}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                        rows={4}
                        placeholder="Eligibility, language requirements, scholarship notes..."
                    ></textarea>
                </label>

                {message && <p className="text-sm font-medium text-primary">{message}</p>}

                <div className="flex gap-3">
                    <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-white font-semibold text-sm hover:opacity-90">
                        Create Opportunity
                    </button>
                </div>
            </form>
        </div>
    );
}
