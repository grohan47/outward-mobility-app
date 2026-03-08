import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
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

function Home() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">PRISM</h1>
                    <p className="text-slate-500">Select a role to enter the prototype</p>
                </div>
                <div className="grid gap-4">
                    <Link to="/student" className="group p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors shadow-sm">
                        <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-primary">Student Dashboard</h3>
                        <p className="text-xs text-slate-500">View opportunities and application status</p>
                    </Link>
                    <Link to="/oge" className="group p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors shadow-sm">
                        <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-primary">OGE Office</h3>
                        <p className="text-xs text-slate-500">Master view of all applications</p>
                    </Link>
                    <Link to="/program-chair" className="group p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors shadow-sm">
                        <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-primary">Program Chair</h3>
                        <p className="text-xs text-slate-500">Open Program Chair task inbox</p>
                    </Link>
                    <Link to="/student-life" className="group p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors shadow-sm">
                        <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-primary">Student Life</h3>
                        <p className="text-xs text-slate-500">Open Student Life task inbox</p>
                    </Link>
                    <Link to="/dean/APP-1" className="group p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors shadow-sm">
                        <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-primary">Dean of Academics</h3>
                        <p className="text-xs text-slate-500">Final approval view (Demo ID: APP-1)</p>
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/student" element={<StudentLayout />}>
                    <Route index element={<StudentDashboard />} />
                    <Route path="applications" element={<StudentApplicationsList />} />
                    <Route path="application/:id" element={<StudentApplicationForm />} />
                    <Route path="messages" element={<StudentMessages />} />
                </Route>
                <Route path="/oge" element={<OGELayout />}>
                    <Route index element={<OGEMasterDashboard />} />
                    <Route path="application/:id" element={<OGEApplicationReview />} />
                </Route>
                <Route path="/program-chair" element={<ProgramChairLayout />}>
                    <Route index element={<ProgramChairTaskInbox />} />
                    <Route path=":id" element={<ProgramChairReview />} />
                </Route>
                <Route path="/student-life" element={<StudentLifeLayout />}>
                    <Route index element={<StudentLifeTaskInbox />} />
                    <Route path=":id" element={<StudentLifeReview />} />
                </Route>
                <Route path="/dean/:id" element={<DeanFinalApproval />} />
            </Routes>
        </Router>
    );
}
