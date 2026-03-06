<script>
    import { page } from "$app/stores";
</script>

<div
    class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen font-display"
>
    <div class="flex h-screen overflow-hidden">
        <!-- Header -->
        <header
            class="flex items-center justify-between border-b border-solid border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-10 py-3 sticky top-0 z-50 w-full absolute top-0 left-0 right-0 h-[65px]"
        >
            <div class="flex items-center gap-8">
                <div class="flex items-center gap-4 text-primary">
                    <div
                        class="size-8 flex items-center justify-center bg-primary/10 rounded-lg"
                    >
                        <span class="material-symbols-outlined text-primary"
                            >diamond</span
                        >
                    </div>
                    <h2
                        class="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-tight"
                    >
                        PRISM
                    </h2>
                </div>
                <label class="flex flex-col min-w-40 h-10 max-w-64">
                    <div
                        class="flex w-full flex-1 items-stretch rounded-lg h-full overflow-hidden"
                    >
                        <div
                            class="text-slate-500 flex bg-slate-100 dark:bg-slate-800 items-center justify-center pl-4"
                        >
                            <span class="material-symbols-outlined text-[20px]"
                                >search</span
                            >
                        </div>
                        <input
                            class="w-full flex-1 border-none bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-0 h-full placeholder:text-slate-400 px-4 pl-2 text-sm"
                            placeholder="Search applications..."
                        />
                    </div>
                </label>
            </div>
            <div class="flex flex-1 justify-end gap-8">
                <nav class="flex items-center gap-9">
                    <a
                        href="#"
                        class="text-slate-600 dark:text-slate-300 text-sm font-medium hover:text-primary transition-colors"
                        >Dashboard</a
                    >
                    <a
                        href="#"
                        class="text-primary text-sm font-medium border-b-2 border-primary py-1"
                        >Applications</a
                    >
                    <a
                        href="#"
                        class="text-slate-600 dark:text-slate-300 text-sm font-medium hover:text-primary transition-colors"
                        >Reports</a
                    >
                    <a
                        href="#"
                        class="text-slate-600 dark:text-slate-300 text-sm font-medium hover:text-primary transition-colors"
                        >Settings</a
                    >
                </nav>
                <div
                    class="bg-slate-200 dark:bg-slate-700 rounded-full size-10 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-800"
                >
                    <img
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDDEzHgWKJnp1wCIAVhYA_kCoSTw-iAsmeA6wePniWoVdYqMsK6U-kNSqJbce8xbaf8g8S_67jGseNKMwS7XOjtLrXPKCSbt1tBgPYqttnSShPWq30Y6ZpHzyHWZgg4PJd8wHrBjnhA71j6GOY6m9CrzJkDuRI-rk47Lm2uLb_jS4VJrDS1oKDybnRJO8yQX0wuLVDl6wo73RygzKWRzfhWUJQDuQ9gbH31UQhqMCyiq9Wr3cn-mWC-KbKHWUCw7wPsWzw6oR_KAQ"
                        alt="User profile"
                        class="w-full h-full object-cover"
                    />
                </div>
            </div>
        </header>

        <div class="flex flex-1 pt-[65px] h-full w-full">
            <aside
                class="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col gap-6 shrink-0 h-full"
            >
                <div>
                    <h1
                        class="text-slate-900 dark:text-white text-base font-bold"
                    >
                        Application Review
                    </h1>
                    <p
                        class="text-primary text-xs font-semibold uppercase tracking-wider mt-1"
                    >
                        ID: #APP-2024-9872
                    </p>
                </div>
                <nav class="flex flex-col gap-1">
                    <a
                        href="#"
                        class="flex items-center gap-3 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg group"
                    >
                        <span class="material-symbols-outlined text-[20px]"
                            >dashboard</span
                        >
                        <span class="text-sm font-medium">Overview</span>
                    </a>
                    <a
                        href="#"
                        class="flex items-center gap-3 px-3 py-2 bg-primary/10 text-primary rounded-lg font-semibold"
                    >
                        <span class="material-symbols-outlined text-[20px]"
                            >groups</span
                        >
                        <span class="text-sm">Student Life</span>
                    </a>
                    <a
                        href="#"
                        class="flex items-center gap-3 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                    >
                        <span class="material-symbols-outlined text-[20px]"
                            >check_circle</span
                        >
                        <span class="text-sm font-medium">Final Decision</span>
                    </a>
                </nav>
                <div
                    class="mt-auto p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800"
                >
                    <p
                        class="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider"
                    >
                        Review SLA
                    </p>
                    <div
                        class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mb-2"
                    >
                        <div
                            class="bg-primary h-1.5 rounded-full"
                            style="width: 66%"
                        ></div>
                    </div>
                    <p class="text-[11px] text-slate-700 dark:text-slate-300">
                        2 of 3 days elapsed
                    </p>
                </div>
            </aside>
            <slot />
        </div>
    </div>
</div>
