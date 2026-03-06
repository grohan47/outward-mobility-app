<script>
    import { page } from "$app/stores";
</script>

<div
    class="flex-1 flex flex-col bg-background-light dark:bg-background-dark overflow-y-auto"
>
    <div class="px-8 pt-6 flex flex-col gap-1">
        <div class="flex items-center gap-2 text-slate-500 text-sm">
            <span>Reviews</span>
            <span class="material-symbols-outlined text-xs">chevron_right</span>
            <span class="text-slate-900 dark:text-slate-200 font-medium"
                >Aryan Sharma - PRISM-2024-001</span
            >
        </div>
        <div
            class="flex justify-between items-end mt-4 pb-6 border-b border-slate-200 dark:border-slate-800"
        >
            <div>
                <h2 class="text-3xl font-black text-slate-900 dark:text-white">
                    Dean Final Review: Aryan Sharma
                </h2>
                <p class="text-slate-600 dark:text-slate-400 mt-1">
                    ID: PRISM-2024-001 | Program: Semester Abroad (TU Delft,
                    Netherlands) 2024
                </p>
            </div>
            <div class="flex gap-3">
                <button
                    class="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm"
                >
                    <span class="material-symbols-outlined text-lg"
                        >download</span
                    > Dossier
                </button>
                <button
                    class="flex items-center gap-2 px-6 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors"
                >
                    <span class="material-symbols-outlined text-lg">block</span>
                    Reject Application
                </button>
                <button
                    class="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary hover:bg-green-600 text-white font-bold text-sm transition-colors shadow-lg shadow-primary/20"
                >
                    <span class="material-symbols-outlined text-lg"
                        >check_circle</span
                    > Grant Final Approval
                </button>
            </div>
        </div>
    </div>

    <div class="p-8 flex gap-8">
        <!-- Left Panel -->
        <div class="flex-[2] flex flex-col gap-6">
            <!-- Stats -->
            <div class="grid grid-cols-4 gap-4">
                <div
                    class="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800"
                >
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        CGPA
                    </p>
                    <p class="text-lg font-bold text-slate-900 dark:text-white">
                        9.42 / 10
                    </p>
                </div>
                <div
                    class="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800"
                >
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        Credits Earned
                    </p>
                    <p class="text-lg font-bold text-slate-900 dark:text-white">
                        112
                    </p>
                </div>
                <div
                    class="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800"
                >
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        Disciplinary
                    </p>
                    <p class="text-lg font-bold text-green-600">Clean Record</p>
                </div>
                <div
                    class="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800"
                >
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        Fin. Clearance
                    </p>
                    <p class="text-lg font-bold text-green-600">Completed</p>
                </div>
            </div>

            <!-- Summary -->
            <section
                class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
                <div
                    class="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50"
                >
                    <h3
                        class="font-bold text-slate-900 dark:text-white flex items-center gap-2"
                    >
                        <span class="material-symbols-outlined text-primary"
                            >analytics</span
                        > Consolidated Review Summary
                    </h3>
                    <span class="text-xs text-slate-500 font-medium"
                        >Last updated: Today, 10:45 AM</span
                    >
                </div>
                <div class="divide-y divide-slate-100 dark:divide-slate-800">
                    <div class="p-5 flex gap-6">
                        <div
                            class="flex flex-col items-center gap-2 min-w-[120px]"
                        >
                            <div
                                class="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-black uppercase rounded-full border border-green-200 dark:border-green-800 flex items-center gap-1"
                            >
                                <span class="material-symbols-outlined text-xs"
                                    >verified</span
                                > APPROVED
                            </div>
                            <div
                                class="size-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
                            >
                                <img
                                    class="w-full h-full object-cover"
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuA187k-QG-6pueFFKTJ3dkf9snGCtIdc6RdUkG4qCVE82hgBKwCecEhbwGeYupzuXyyXQHgK4dCmrIfsiX0_zepFelQJxfoCPqyAnjcs_DIgnZTls3LeUB9WxZBstiDghT56QEh_bdXmh3e8IKFM9vEZwdMdgEh4pOB9WxZBstiDghT56QEh_bdXmh3e8IKFM9vEZwdMdgEh4pOBfdqK_Ek5jKKPzPT-b-kB38QSJ2N29ncW7ez6F1dZ-V-hkYdzr5In_3_A7UjI4oTooERJlaBzv0hJOuDux0eDUnB6DnbP_BkPQ6lY-VGDRg"
                                    alt="UG Academics"
                                />
                            </div>
                            <p
                                class="text-[10px] text-slate-500 font-bold text-center"
                            >
                                UG Academics
                            </p>
                        </div>
                        <div class="flex-1">
                            <div class="flex justify-between items-start">
                                <h4
                                    class="text-sm font-bold text-slate-900 dark:text-white"
                                >
                                    Dr. Vikram Sahay
                                </h4>
                                <p class="text-xs text-slate-400 italic">
                                    2 days ago
                                </p>
                            </div>
                            <p
                                class="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed"
                            >
                                Student meets all prerequisite requirements for
                                TU Delft. The course mapping for 'Data
                                Structures' and 'Signals' has been vetted. CGPA
                                is well above the threshold. Recommendation:
                                Proceed with full approval.
                            </p>
                        </div>
                    </div>
                    <!-- Repeat for Student Life -->
                    <div class="p-5 flex gap-6">
                        <div
                            class="flex flex-col items-center gap-2 min-w-[120px]"
                        >
                            <div
                                class="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-black uppercase rounded-full border border-green-200 dark:border-green-800 flex items-center gap-1"
                            >
                                <span class="material-symbols-outlined text-xs"
                                    >verified</span
                                > APPROVED
                            </div>
                            <div
                                class="size-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
                            >
                                <img
                                    class="w-full h-full object-cover"
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBNG49i_9JEOK7gOshkiCiGeHvIwlW5fvEMq3nlkr8bhbowdJSg6ytFA9-ss4Pmf3z1Rc2Wt9xg_dbFvifDbtxzGVUjbfx74QI7YPnyDyWTdls2UKLBVFwAQ3Vf5W0uzvYR0Z2NWLf3b1JgoQOQkBKcHjMNTdbM2EkvbK-vUYWQhe4QOs1w0EJKaWkBHeKcHXmZ9gJK2yhZW3B6Zc47jkaLKZb2IRaPZ4MOoxpXuZTit8SDzA1wCVZo4WBmCdUnI8FZgQNVijCS2Q"
                                    alt="Student Life"
                                />
                            </div>
                            <p
                                class="text-[10px] text-slate-500 font-bold text-center"
                            >
                                Student Life
                            </p>
                        </div>
                        <div class="flex-1">
                            <div class="flex justify-between items-start">
                                <h4
                                    class="text-sm font-bold text-slate-900 dark:text-white"
                                >
                                    Ms. Ananya Iyer
                                </h4>
                                <p class="text-xs text-slate-400 italic">
                                    1 day ago
                                </p>
                            </div>
                            <p
                                class="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed"
                            >
                                Visa documentation support letter has been
                                drafted. Student has completed the cultural
                                sensitivity workshop. No prior housing or
                                behavioral issues reported in the hostel.
                            </p>
                        </div>
                    </div>

                    <!-- Repeat for Program Chair -->
                    <div class="p-5 flex gap-6">
                        <div
                            class="flex flex-col items-center gap-2 min-w-[120px]"
                        >
                            <div
                                class="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-black uppercase rounded-full border border-green-200 dark:border-green-800 flex items-center gap-1"
                            >
                                <span class="material-symbols-outlined text-xs"
                                    >verified</span
                                > APPROVED
                            </div>
                            <div
                                class="size-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
                            >
                                <img
                                    class="w-full h-full object-cover"
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQkewfUP9H7C1YS0IEaLo7nWYbkTppYKrJTIz5svm4SJnLFFTOFcYkdE9x3ZHzdM7Gw-1Dc8NXJYwkIljhFO1l2C4DJraAJtLwbOGGDZsKz9LmDCyCyjn_xnWWhuvJyQGM1-mca_FRmaz8igyblJS-u_ncjq-kaChW9xxemdzsCEapLiv5LGr5rRsuetnaOq26JYx4WcxLqAmXwkHq2f5vAYVteIe13YwfwNJgroQ5JSiFgmIwJrrPK-Fu3oxgrTYVbnM4iquR3Q"
                                    alt="Program Chair"
                                />
                            </div>
                            <p
                                class="text-[10px] text-slate-500 font-bold text-center"
                            >
                                Program Chair
                            </p>
                        </div>
                        <div class="flex-1">
                            <div class="flex justify-between items-start">
                                <h4
                                    class="text-sm font-bold text-slate-900 dark:text-white"
                                >
                                    Prof. Rajesh Gupta
                                </h4>
                                <p class="text-xs text-slate-400 italic">
                                    4 hours ago
                                </p>
                            </div>
                            <p
                                class="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed"
                            >
                                The research focus of the student aligns
                                perfectly with TU Delft's mobility exchange
                                program. This will significantly benefit the
                                student's final year capstone project.
                                Recommended for Dean's final sign-off.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Statement -->
            <div
                class="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800"
            >
                <h4
                    class="text-sm font-bold text-slate-900 dark:text-white mb-3"
                >
                    Candidate Motivation Statement
                </h4>
                <div
                    class="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border-l-4 border-primary italic text-slate-700 dark:text-slate-300 text-sm leading-loose"
                >
                    "Studying at TU Delft will allow me to explore advanced
                    robotics modules not currently available on-campus. My goal
                    is to integrate these learnings into the University's
                    Sustainable Tech initiative upon my return..."
                </div>
                <button
                    class="mt-4 text-primary text-xs font-bold hover:underline flex items-center gap-1"
                >
                    View Full Application <span
                        class="material-symbols-outlined text-xs"
                        >open_in_new</span
                    >
                </button>
            </div>
        </div>

        <!-- Right Panel -->
        <div class="flex-1 flex flex-col gap-6">
            <!-- Comm History -->
            <div
                class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col h-[500px]"
            >
                <div
                    class="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                >
                    <h3
                        class="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2"
                    >
                        <span
                            class="material-symbols-outlined text-primary text-lg"
                            >forum</span
                        > Communication History
                    </h3>
                </div>
                <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                    <div class="flex gap-3">
                        <div
                            class="size-8 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center"
                        >
                            <span
                                class="material-symbols-outlined text-sm text-slate-500"
                                >mail</span
                            >
                        </div>
                        <div>
                            <p
                                class="text-xs font-bold text-slate-900 dark:text-white"
                            >
                                Automated System
                            </p>
                            <p class="text-xs text-slate-500">
                                Document Upload: Passport (Valid)
                            </p>
                            <p class="text-[10px] text-slate-400 mt-1">
                                Oct 1, 09:12 AM
                            </p>
                        </div>
                    </div>
                    <!-- More logs -->
                </div>
                <div
                    class="p-3 border-t border-slate-200 dark:border-slate-800"
                >
                    <div class="relative">
                        <textarea
                            class="w-full rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-primary focus:border-primary resize-none"
                            placeholder="Add a private note or remark..."
                            rows="3"
                        ></textarea>
                        <button
                            class="absolute bottom-2 right-2 p-1.5 bg-primary text-white rounded-md"
                            ><span class="material-symbols-outlined text-sm"
                                >send</span
                            ></button
                        >
                    </div>
                </div>
            </div>

            <!-- Action Card -->
            <div
                class="bg-primary/5 dark:bg-primary/10 p-6 rounded-xl border border-primary/20 flex flex-col gap-4"
            >
                <h4
                    class="text-sm font-bold text-primary flex items-center gap-2"
                >
                    <span class="material-symbols-outlined">gavel</span> Dean's Final
                    Decision
                </h4>
                <p class="text-xs text-slate-600 dark:text-slate-400">
                    Your approval will finalize this application and trigger the
                    official acceptance letter for the student.
                </p>
                <div class="flex flex-col gap-3">
                    <button
                        class="w-full py-3 bg-primary text-white font-bold rounded-lg shadow-lg shadow-primary/30 flex items-center justify-center gap-2 hover:bg-green-600 transition-all"
                    >
                        <span class="material-symbols-outlined">verified</span> Grant
                        Final Approval
                    </button>
                    <button
                        class="w-full py-2 bg-transparent text-slate-500 dark:text-slate-400 text-xs font-bold hover:text-red-500 transition-colors"
                    >
                        Hold for Clarification
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>
