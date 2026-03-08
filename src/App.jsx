import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import StudentDashboard from './screens/StudentDashboard';
import OGEMasterDashboard from './screens/OGEMasterDashboard';
import ProgramChairReview from './screens/ProgramChairReview';
import ProgramChairTaskInbox from './screens/ProgramChairTaskInbox';
import StudentLifeReview from './screens/StudentLifeReview';
import StudentLifeTaskInbox from './screens/StudentLifeTaskInbox';
import DeanFinalApproval from './screens/DeanFinalApproval';
import StudentLayout from './layouts/StudentLayout';
import OGELayout from './layouts/OGELayout';
import ProgramChairLayout from './layouts/ProgramChairLayout';
import StudentLifeLayout from './layouts/StudentLifeLayout';
import StudentApplicationForm from './screens/StudentApplicationForm';
import StudentApplicationsList from './screens/StudentApplicationsList';
import StudentMessages from './screens/StudentMessages';
import OGEApplicationReview from './screens/OGEApplicationReview';
import OGECreateOpportunity from './screens/OGECreateOpportunity';

// Dummy role login options and the route each role lands on.
// Where each stakeholder enters the app from: route below.
const ROLE_OPTIONS = [
    {
        key: 'student',
        label: 'Student',
        email: 'student@prism.edu',
        password: 'student123',
        route: '/student',
    },
    {
        key: 'oge',
        label: 'OGE',
        email: 'oge@prism.edu',
        password: 'oge123',
        route: '/oge',
    },
    {
        key: 'program-chair',
        label: 'Program Chair',
        email: 'chair@prism.edu',
        password: 'chair123',
        route: '/program-chair',
    },
    {
        key: 'student-life',
        label: 'Student Life',
        email: 'life@prism.edu',
        password: 'life123',
        route: '/student-life',
    },
    {
        key: 'dean',
        label: 'Dean',
        email: 'dean@prism.edu',
        password: 'dean123',
        route: '/dean/APP-1',
    },
];

function Home() {
    const navigate = useNavigate();
    // Default tab on first load = student.
    const [roleKey, setRoleKey] = useState('student');

    const selectedRole = ROLE_OPTIONS.find((option) => option.key === roleKey) ?? ROLE_OPTIONS[0];
    const [email, setEmail] = useState(selectedRole.email);
    const [password, setPassword] = useState(selectedRole.password);

    function selectRole(nextRoleKey) {
        // Fields auto-change by role to keep demo login fast.
        const nextRole = ROLE_OPTIONS.find((option) => option.key === nextRoleKey);
        if (!nextRole) {
            return;
        }
        setRoleKey(nextRole.key);
        setEmail(nextRole.email);
        setPassword(nextRole.password);
    }

    function handleSubmit(event) {
        event.preventDefault();
        // This is where selected role login redirects into stakeholder flow.
        // No backend auth here yet; this is intentionally frontend-only routing.
        navigate(selectedRole.route);
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
            <form onSubmit={handleSubmit} className="max-w-xl w-full space-y-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
                <div className="text-center">
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">PRISM</h1>
                    <p className="text-slate-500">Dummy Login (Frontend Only)</p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {ROLE_OPTIONS.map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            onClick={() => selectRole(option.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${roleKey === option.key ? 'bg-primary text-white border-primary' : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-primary'}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                <div className="space-y-4">
                    <label className="block">
                        <span className="block text-xs font-semibold text-slate-600 mb-1">Email</span>
                        <input
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm"
                            type="email"
                        />
                    </label>

                    <label className="block">
                        <span className="block text-xs font-semibold text-slate-600 mb-1">Password</span>
                        <input
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm"
                            type="password"
                        />
                    </label>
                </div>

                <button type="submit" className="w-full h-10 rounded-lg bg-primary text-white font-bold text-sm hover:opacity-90 transition-opacity">
                    Login as {selectedRole.label}
                </button>
            </form>
        </div>
    );
}

export default function App() {
    return (
        <Router>
            <Routes>
                {/* Root route = dummy frontend login screen. */}
                <Route path="/" element={<Home />} />
                {/* Nested routes use role layouts + Outlet so each role keeps a consistent shell. */}
                {/* Student stakeholder flow. */}
                <Route path="/student" element={<StudentLayout />}>
                    <Route index element={<StudentDashboard />} />
                    <Route path="applications" element={<StudentApplicationsList />} />
                    <Route path="application/:id" element={<StudentApplicationForm />} />
                    <Route path="messages" element={<StudentMessages />} />
                </Route>
                {/* OGE stakeholder flow including Create Opportunity form. */}
                <Route path="/oge" element={<OGELayout />}>
                    <Route index element={<OGEMasterDashboard />} />
                    <Route path="application/:id" element={<OGEApplicationReview />} />
                    <Route path="opportunities/new" element={<OGECreateOpportunity />} />
                </Route>
                {/* Program Chair stakeholder flow (inbox -> detail review). */}
                <Route path="/program-chair" element={<ProgramChairLayout />}>
                    <Route index element={<ProgramChairTaskInbox />} />
                    <Route path=":id" element={<ProgramChairReview />} />
                </Route>
                {/* Student Life stakeholder flow (inbox -> detail review). */}
                <Route path="/student-life" element={<StudentLifeLayout />}>
                    <Route index element={<StudentLifeTaskInbox />} />
                    <Route path=":id" element={<StudentLifeReview />} />
                </Route>
                {/* Dean stakeholder review route. */}
                <Route path="/dean/:id" element={<DeanFinalApproval />} />
            </Routes>
        </Router>
    );
}
