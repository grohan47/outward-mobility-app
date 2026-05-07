import React from 'react';
import { Outlet } from 'react-router-dom';

export default function ProgramChairLayout() {
    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
            <Outlet />
        </div>
    );
}
