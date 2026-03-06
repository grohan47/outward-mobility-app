<script>
    let currentFilter = "All";
</script>

<div
    class="flex flex-wrap items-center gap-2 mb-4 text-sm text-slate-500 dark:text-slate-400"
>
    <span>Home</span>
    <span class="material-symbols-outlined text-sm">chevron_right</span>
    <span class="text-slate-900 dark:text-white font-medium"
        >Master Dashboard</span
    >
</div>
<div
    class="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8"
>
    <div class="flex flex-col gap-1">
        <h1
            class="text-slate-900 dark:text-white text-3xl font-black leading-tight tracking-tight"
        >
            PRISM Master Dashboard
        </h1>
        <p class="text-slate-500 dark:text-slate-400 text-base font-normal">
            Track and manage student mobility across all university partners.
        </p>
    </div>
    <div class="flex gap-3">
        <button
            class="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
        >
            <span class="material-symbols-outlined text-xl">download</span>
            Export Data
        </button>
    </div>
</div>

<!-- Filters -->
<div
    class="flex flex-wrap gap-3 mb-6 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800"
>
    <button
        class="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
    >
        <span>University: All</span>
        <span class="material-symbols-outlined text-lg">expand_more</span>
    </button>
    <button
        class="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
    >
        <span>Status: Active</span>
        <span class="material-symbols-outlined text-lg">expand_more</span>
    </button>
    <button
        class="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
    >
        <span>Priority: High</span>
        <span class="material-symbols-outlined text-lg">expand_more</span>
    </button>
    <div class="flex-1"></div>
    <button
        class="flex items-center gap-2 px-4 py-2 text-slate-500 text-sm font-medium hover:text-primary transition-colors"
    >
        <span class="material-symbols-outlined text-lg">filter_alt_off</span>
        Clear Filters
    </button>
</div>

<!-- Table -->
<div
    class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
>
    <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
            <thead
                class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800"
            >
                <tr>
                    <th
                        class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >Student Name</th
                    >
                    <th
                        class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >Target University</th
                    >
                    <th
                        class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >Current Stage & Progress</th
                    >
                    <th
                        class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >Time Remaining</th
                    >
                    <th
                        class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >Flags</th
                    >
                    <th
                        class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >Actions</th
                    >
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <!-- Row 1 -->
                <tr
                    class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center gap-3">
                            <div
                                class="size-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300"
                            >
                                AS
                            </div>
                            <div class="flex flex-col">
                                <span
                                    class="text-sm font-semibold text-slate-900 dark:text-white"
                                    >Arjun Sharma</span
                                >
                                <span class="text-[10px] text-slate-500"
                                    >ID: PL-2024-001</span
                                >
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span
                            class="text-sm font-medium text-slate-700 dark:text-slate-300"
                            >UC Berkeley</span
                        >
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex flex-col gap-2">
                            <span
                                class="inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                            >
                                Student Life Review
                            </span>
                            <div class="flex gap-1 w-24">
                                <div
                                    class="h-1 flex-1 rounded-full bg-primary"
                                ></div>
                                <div
                                    class="h-1 flex-1 rounded-full bg-primary"
                                ></div>
                                <div
                                    class="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-700"
                                ></div>
                                <div
                                    class="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-700"
                                ></div>
                                <div
                                    class="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-700"
                                ></div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center gap-2">
                            <div
                                class="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                            >
                                <div
                                    class="h-full bg-red-500"
                                    style="width: 85%"
                                ></div>
                            </div>
                            <span class="text-xs font-bold text-red-600"
                                >1 Day Left</span
                            >
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex gap-1">
                            <span
                                class="material-symbols-outlined text-orange-500 text-base"
                                title="Missing Documents">description</span
                            >
                            <span
                                class="material-symbols-outlined text-red-500 text-base"
                                title="Urgent Action Required"
                                >priority_high</span
                            >
                        </div>
                    </td>
                    <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-slate-500"
                    >
                        <button
                            class="text-slate-400 hover:text-primary transition-colors"
                        >
                            <span class="material-symbols-outlined"
                                >more_vert</span
                            >
                        </button>
                    </td>
                </tr>
                <!-- Row 2 -->
                <tr
                    class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center gap-3">
                            <div
                                class="size-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300"
                            >
                                MK
                            </div>
                            <div class="flex flex-col">
                                <span
                                    class="text-sm font-semibold text-slate-900 dark:text-white"
                                    >Meera Kapoor</span
                                >
                                <span class="text-[10px] text-slate-500"
                                    >ID: PL-2024-042</span
                                >
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span
                            class="text-sm font-medium text-slate-700 dark:text-slate-300"
                            >UPenn</span
                        >
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex flex-col gap-2">
                            <span
                                class="inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            >
                                Academic Verification
                            </span>
                            <div class="flex gap-1 w-24">
                                <div
                                    class="h-1 flex-1 rounded-full bg-primary"
                                ></div>
                                <div
                                    class="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-700"
                                ></div>
                                <div
                                    class="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-700"
                                ></div>
                                <div
                                    class="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-700"
                                ></div>
                                <div
                                    class="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-700"
                                ></div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center gap-2">
                            <div
                                class="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                            >
                                <div
                                    class="h-full bg-orange-400"
                                    style="width: 60%"
                                ></div>
                            </div>
                            <span class="text-xs font-bold text-orange-500"
                                >3 Days Left</span
                            >
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span
                            class="material-symbols-outlined text-slate-300 text-base"
                            >remove_circle_outline</span
                        >
                    </td>
                    <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-slate-500"
                    >
                        <button
                            class="text-slate-400 hover:text-primary transition-colors"
                        >
                            <span class="material-symbols-outlined"
                                >more_vert</span
                            >
                        </button>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <div
        class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between"
    >
        <p class="text-sm text-slate-500 dark:text-slate-400">
            Showing <span class="font-semibold">2</span> of
            <span class="font-semibold">124</span> applications
        </p>
        <div class="flex gap-2">
            <button
                class="px-3 py-1 text-sm font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >Previous</button
            >
            <button
                class="px-3 py-1 text-sm font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                >Next</button
            >
        </div>
    </div>
</div>
