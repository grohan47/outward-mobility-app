<script>
    import { page } from "$app/stores";
</script>

<div
    class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen font-display"
>
    <div class="flex flex-col min-h-screen">
        <!-- Header -->
        <header
            class="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 sticky top-0 z-50"
        >
            <div class="flex items-center gap-8">
                <div class="flex items-center gap-3 text-primary">
                    <div class="size-8">
                        <svg
                            fill="none"
                            viewBox="0 0 48 48"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                clip-rule="evenodd"
                                d="M47.2426 24L24 47.2426L0.757355 24L24 0.757355L47.2426 24ZM12.2426 21H35.7574L24 9.24264L12.2426 21Z"
                                fill="currentColor"
                                fill-rule="evenodd"
                            ></path>
                        </svg>
                    </div>
                    <h2
                        class="text-slate-900 dark:text-white text-xl font-bold leading-tight tracking-tight"
                    >
                        PRISM
                    </h2>
                </div>
                <div
                    class="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg"
                >
                    <span
                        class="text-slate-500 text-sm font-medium uppercase tracking-wider"
                        >Review Mode</span
                    >
                </div>
            </div>
            <div class="flex flex-1 justify-center max-w-xl px-4">
                <label class="flex w-full flex-col h-10">
                    <div
                        class="flex w-full flex-1 items-stretch rounded-lg h-full"
                    >
                        <div
                            class="text-slate-400 flex bg-slate-100 dark:bg-slate-800 items-center justify-center pl-4 rounded-l-lg border-r-0"
                        >
                            <span class="material-symbols-outlined">search</span
                            >
                        </div>
                        <input
                            class="form-input flex w-full min-w-0 flex-1 border-none bg-slate-100 dark:bg-slate-800 focus:ring-0 h-full placeholder:text-slate-400 px-4 rounded-r-lg text-sm"
                            placeholder="Search applications, students..."
                            value=""
                        />
                    </div>
                </label>
            </div>
            <div class="flex items-center gap-4">
                <button
                    class="flex items-center justify-center rounded-lg h-10 w-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                    <span class="material-symbols-outlined">notifications</span>
                </button>
                <div class="h-8 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
                <div class="flex items-center gap-3">
                    <div class="text-right hidden sm:block">
                        <p
                            class="text-sm font-bold leading-none text-slate-900 dark:text-white"
                        >
                            Dr. Sarah Jenkins
                        </p>
                        <p class="text-xs text-slate-500 mt-1">Program Chair</p>
                    </div>
                    <div
                        class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-700"
                    ></div>
                </div>
            </div>
        </header>

        <main class="flex-1 flex flex-col">
            <slot />
        </main>
    </div>
</div>
