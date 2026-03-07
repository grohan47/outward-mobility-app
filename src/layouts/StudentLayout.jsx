import React from 'react';
import { Outlet } from 'react-router-dom';
import StudentSidebar from '../components/StudentSidebar';

export default function StudentLayout() {
    return (
        <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark font-body">
            <StudentSidebar />
            <main className="flex-1 overflow-y-auto ml-64 p-8">
                <header className="mb-8">
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Student Dashboard</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Welcome back to Plaksha Review Interface for Student Mobility</p>
                </header>

                <Outlet />
            </main>
        </div>
    );
}