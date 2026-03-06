<script>
    import StudentSidebar from "$lib/components/StudentSidebar.svelte";
</script>

<div
    class="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark font-body"
>
    <StudentSidebar />
    <main class="flex-1 overflow-y-auto ml-64 p-8">
        <header class="mb-8">
            <h2
                class="text-3xl font-black text-slate-900 dark:text-white tracking-tight"
            >
                Student Dashboard
            </h2>
            <p class="text-slate-500 dark:text-slate-400 mt-1">
                Welcome back to Plaksha Review Interface for Student Mobility
            </p>
        </header>

        <slot />
    </main>
</div>
