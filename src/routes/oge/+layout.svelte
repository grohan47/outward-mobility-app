<script>
    import { page } from "$app/stores";
</script>

<div
    class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display transition-colors duration-200"
>
    <div
        class="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-x-hidden"
    >
        <!-- Header -->
        <header
            class="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-3 bg-white dark:bg-slate-900 sticky top-0 z-50"
        >
            <div class="flex items-center gap-8">
                <div class="flex items-center gap-3 text-primary">
                    <span class="material-symbols-outlined text-3xl font-bold"
                        >diamond</span
                    >
                    <h2
                        class="text-slate-900 dark:text-white text-xl font-bold leading-tight tracking-tight"
                    >
                        PRISM
                    </h2>
                </div>
                <label class="flex flex-col min-w-40 h-10 max-w-64">
                    <div
                        class="flex w-full flex-1 items-stretch rounded-lg h-full"
                    >
                        <div
                            class="text-slate-500 dark:text-slate-400 flex border-none bg-slate-100 dark:bg-slate-800 items-center justify-center pl-4 rounded-l-lg"
                            data-icon="Search"
                        >
                            <span class="material-symbols-outlined text-xl"
                                >search</span
                            >
                        </div>
                        <input
                            class="form-input flex w-full min-w-0 flex-1 border-none bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-0 h-full placeholder:text-slate-500 rounded-r-lg px-3 text-sm font-normal"
                            placeholder="Search applications..."
                            value=""
                        />
                    </div>
                </label>
            </div>
            <div class="flex flex-1 justify-end gap-8 items-center">
                <nav className="hidden md:flex items-center gap-8">
                    <a
                        href="/oge"
                        class="text-sm font-medium hover:text-primary transition-colors {$page
                            .url.pathname === '/oge'
                            ? 'text-primary font-bold border-b-2 border-primary pb-1'
                            : 'text-slate-600 dark:text-slate-400'}"
                        >Dashboard</a
                    >
                    <a
                        href="/oge/applications"
                        class="text-sm font-medium hover:text-primary transition-colors {$page.url.pathname.includes(
                            '/oge/applications',
                        )
                            ? 'text-primary font-bold border-b-2 border-primary pb-1'
                            : 'text-slate-600 dark:text-slate-400'}"
                        >Applications</a
                    >
                    <a
                        href="#"
                        class="text-slate-600 dark:text-slate-400 text-sm font-medium hover:text-primary transition-colors"
                        >Analytics</a
                    >
                    <a
                        href="#"
                        class="text-slate-600 dark:text-slate-400 text-sm font-medium hover:text-primary transition-colors"
                        >Settings</a
                    >
                </nav>
                <div class="flex items-center gap-4">
                    <span
                        class="material-symbols-outlined text-slate-600 dark:text-slate-400 cursor-pointer"
                        >notifications</span
                    >
                    <div
                        class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-700"
                    ></div>
                </div>
            </div>
        </header>

        <div class="flex flex-1 overflow-hidden">
            <!-- Sidebar -->
            <aside
                class="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-col hidden lg:flex h-full fixed left-0 top-16 z-40"
            >
                <div class="p-6">
                    <div class="flex flex-col mb-8">
                        <h1
                            class="text-slate-900 dark:text-white text-base font-bold"
                        >
                            OGE Office
                        </h1>
                        <p
                            class="text-slate-500 text-xs font-medium uppercase tracking-wider"
                        >
                            Admin Dashboard
                        </p>
                    </div>
                    <nav class="flex flex-col gap-1">
                        <a
                            href="/oge"
                            class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors {$page
                                .url.pathname === '/oge'
                                ? 'bg-primary/10 text-primary'
                                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}"
                        >
                            <span class="material-symbols-outlined text-[22px]"
                                >dashboard</span
                            >
                            <p class="text-sm font-semibold">Master View</p>
                        </a>
                        <a
                            href="/oge/reminders"
                            class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors {$page
                                .url.pathname === '/oge/reminders'
                                ? 'bg-primary/10 text-primary'
                                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}"
                        >
                            <span class="material-symbols-outlined text-[22px]"
                                >campaign</span
                            >
                            <p class="text-sm font-medium">Manual Reminders</p>
                        </a>
                        <a
                            href="/oge/alerts"
                            class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors {$page
                                .url.pathname === '/oge/alerts'
                                ? 'bg-primary/10 text-primary'
                                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}"
                        >
                            <span class="material-symbols-outlined text-[22px]"
                                >warning</span
                            >
                            <p class="text-sm font-medium">System Alerts</p>
                            <span
                                class="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full"
                                >4</span
                            >
                        </a>
                        <a
                            href="/oge/partners"
                            class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors {$page
                                .url.pathname === '/oge/partners'
                                ? 'bg-primary/10 text-primary'
                                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}"
                        >
                            <span class="material-symbols-outlined text-[22px]"
                                >account_balance</span
                            >
                            <p class="text-sm font-medium">
                                University Partners
                            </p>
                        </a>
                        <a
                            href="#"
                            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <span class="material-symbols-outlined text-[22px]"
                                >timer_10_alt_1</span
                            >
                            <p class="text-sm font-medium">SLA Configuration</p>
                        </a>
                    </nav>
                </div>
            </aside>

            <main
                class="flex-1 flex flex-col min-w-0 bg-background-light dark:bg-background-dark p-6 lg:p-10 ml-64 overflow-y-auto"
            >
                <slot />
            </main>
        </div>
    </div>
</div>
