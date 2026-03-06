import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import StudentDashboard from './screens/StudentDashboard';
import OGEMasterDashboard from './screens/OGEMasterDashboard';
import ProgramChairReview from './screens/ProgramChairReview';
import StudentLifeReview from './screens/StudentLifeReview';
import DeanFinalApproval from './screens/DeanFinalApproval';

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
                    <Link to="/program-chair/APP-1" className="group p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors shadow-sm">
                        <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-primary">Program Chair</h3>
                        <p className="text-xs text-slate-500">Review course mappings (Demo ID: APP-1)</p>
                    </Link>
                    <Link to="/student-life/APP-1" className="group p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors shadow-sm">
                        <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-primary">Student Life</h3>
                        <p className="text-xs text-slate-500">Conduct and integrity checks (Demo ID: APP-1)</p>
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
                <Route path="/student" element={<StudentDashboard />} />
                <Route path="/oge" element={<OGEMasterDashboard />} />
                <Route path="/program-chair/:id" element={<ProgramChairReview />} />
                <Route path="/student-life/:id" element={<StudentLifeReview />} />
                <Route path="/dean/:id" element={<DeanFinalApproval />} />
            </Routes>
        </Router>
    );
}
