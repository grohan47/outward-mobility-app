<script>
    import { page } from "$app/stores";
    import { onMount } from "svelte";

    let activeSection = "personal";
    let isNew = $page.params.id === "new";
    let isDraft = $page.params.id === "draft";
    let showChat = !isNew && !isDraft; // Only show chat for submitted apps

    // dynamic University name processing
    let targetUniversity = "";
    if (isNew && $page.url.searchParams.get("university")) {
        targetUniversity = $page.url.searchParams.get("university");
    } else if (isDraft) {
        targetUniversity = "Georgia Institute of Technology";
    } else {
        targetUniversity = "National University of Singapore";
    }

    let chatMessages = [
        {
            id: 1,
            sender: "OGE Office",
            text: "Please upload a clearer copy of your Semester 3 Marksheet.",
            time: "2 days ago",
            isMe: false,
        },
        {
            id: 2,
            sender: "You",
            text: "Sure, I have uploaded the new scan in the Documents section.",
            time: "1 day ago",
            isMe: true,
        },
    ];

    let newMessage = "";

    function sendMessage() {
        if (!newMessage.trim()) return;
        chatMessages = [
            ...chatMessages,
            {
                id: Date.now(),
                sender: "You",
                text: newMessage,
                time: "Just now",
                isMe: true,
            },
        ];
        newMessage = "";
    }

    function scrollToSection(id) {
        activeSection = id;
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }
</script>

<div
    class="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50 dark:bg-slate-950"
>
    <!-- Application Section Sidebar (Left) -->
    <aside
        class="w-64 shrink-0 overflow-y-auto border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 px-4 hidden lg:block"
    >
        <h3
            class="px-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4"
        >
            Application Sections
        </h3>
        <nav class="space-y-1">
            {#each ["personal", "academic", "exchange", "documents"] as section}
                <button
                    class="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize {activeSection ===
                    section
                        ? 'bg-primary/10 text-primary'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}"
                    on:click={() => scrollToSection(section)}
                >
                    {section.replace("-", " ")}
                    {section === "documents" ? "& Essays" : "Information"}
                </button>
            {/each}
        </nav>

        <div class="mt-8 px-2">
            <div
                class="rounded-xl bg-slate-100 dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700"
            >
                <p
                    class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2"
                >
                    Completion
                </p>
                <div
                    class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2"
                >
                    <div
                        class="bg-primary h-2 rounded-full transition-all duration-500"
                        style="width: {isNew ? '10%' : '45%'}"
                    ></div>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-300">
                    {isNew ? "10%" : "45%"} Completed
                </p>
            </div>
        </div>
    </aside>

    <!-- Main Content Wrapper (Center + Optional Right Chat) -->
    <div class="flex-1 flex overflow-hidden">
        <!-- Main Form Area -->
        <div class="flex-1 overflow-y-auto scroll-smooth">
            <div class="max-w-3xl mx-auto py-8 px-6 space-y-10">
                <header
                    class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-6"
                >
                    <div>
                        <h1
                            class="text-2xl font-black text-slate-900 dark:text-white"
                        >
                            {isNew
                                ? "New Application"
                                : "Semester Exchange Application"}
                        </h1>
                        <p class="text-slate-500 dark:text-slate-400 mt-1">
                            Fall 2024 • {isNew
                                ? "Drafting..."
                                : "Application #APP-2024-001"}
                        </p>
                    </div>
                    <div class="flex gap-3">
                        <div
                            class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border {isNew ||
                            isDraft
                                ? 'bg-slate-100 text-slate-700 border-slate-200'
                                : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'}"
                        >
                            {isNew || isDraft ? "Draft" : "Submitted"}
                        </div>
                    </div>
                </header>

                <!-- Personal Info -->
                <section id="personal" class="scroll-mt-6">
                    <h2
                        class="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"
                    >
                        <span
                            class="flex items-center justify-center size-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500"
                            >1</span
                        >
                        Personal Information
                    </h2>
                    <div
                        class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6"
                    >
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label
                                    class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
                                    >Full Legal Name</label
                                >
                                <input
                                    type="text"
                                    value="Arjun Sharma"
                                    class="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary sm:text-sm"
                                />
                            </div>
                            <div>
                                <label
                                    class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
                                    >Student ID</label
                                >
                                <input
                                    type="text"
                                    value="PL-2022-042"
                                    class="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 focus:ring-primary focus:border-primary sm:text-sm cursor-not-allowed"
                                    readonly
                                />
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label
                                    class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
                                    >University Email</label
                                >
                                <input
                                    type="email"
                                    value="arjun.sharma@plaksha.edu.in"
                                    class="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 focus:ring-primary focus:border-primary sm:text-sm cursor-not-allowed"
                                    readonly
                                />
                            </div>
                            <div>
                                <label
                                    class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
                                    >Phone Number</label
                                >
                                <input
                                    type="tel"
                                    class="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary sm:text-sm"
                                    placeholder="+91 99999 99999"
                                    value={!isNew ? "+91 99999 99999" : ""}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Academic Info -->
                <section id="academic" class="scroll-mt-6">
                    <h2
                        class="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"
                    >
                        <span
                            class="flex items-center justify-center size-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500"
                            >2</span
                        >
                        Academic Records
                    </h2>
                    <div
                        class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6"
                    >
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label
                                    class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
                                    >Current CGPA</label
                                >
                                <input
                                    type="number"
                                    step="0.01"
                                    class="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary sm:text-sm"
                                    placeholder="0.00"
                                    value={!isNew ? "9.42" : ""}
                                />
                            </div>
                            <div>
                                <label
                                    class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
                                    >Current Semester</label
                                >
                                <select
                                    class="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary sm:text-sm"
                                >
                                    <option>Semester 4</option>
                                    <option>Semester 5</option>
                                    <option>Semester 6</option>
                                </select>
                            </div>
                            <div>
                                <label
                                    class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
                                    >Major</label
                                >
                                <select
                                    class="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary sm:text-sm"
                                >
                                    <option>Computer Science</option>
                                    <option>Robotics</option>
                                    <option>Biological Systems</option>
                                    <option>Data Science</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Exchange Preferences -->
                <section id="exchange" class="scroll-mt-6">
                    <h2
                        class="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"
                    >
                        <span
                            class="flex items-center justify-center size-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500"
                            >3</span
                        >
                        Exchange Preferences
                    </h2>
                    <div
                        class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6"
                    >
                        <div>
                            <label
                                class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
                                >Target University</label
                            >
                            <select
                                class="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary sm:text-sm"
                                value={targetUniversity}
                            >
                                <option value="" disabled selected
                                    >Select a Partner University</option
                                >
                                <option>UC Berkeley</option>
                                <option>Purdue University</option>
                                <option>TU Delft</option>
                                <option>University of Toronto</option>
                                <option>ETH Zurich</option>
                                <option>Stanford University</option>
                                <option>National University of Singapore</option
                                >
                                <option>Georgia Institute of Technology</option>
                            </select>
                        </div>

                        <div>
                            <label
                                class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3"
                                >Proposed Course Mapping</label
                            >
                            <div
                                class="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden"
                            >
                                <table class="w-full text-sm text-left">
                                    <thead
                                        class="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700"
                                    >
                                        <tr>
                                            <th class="px-4 py-3"
                                                >Course Code (Host)</th
                                            >
                                            <th class="px-4 py-3"
                                                >Course Title (Host)</th
                                            >
                                            <th class="px-4 py-3"
                                                >Equivalent (Plaksha)</th
                                            >
                                            <th class="px-4 py-3 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody
                                        class="divide-y divide-slate-100 dark:divide-slate-800"
                                    >
                                        <tr>
                                            <td class="p-2"
                                                ><input
                                                    type="text"
                                                    placeholder="CS101"
                                                    value={!isNew
                                                        ? "CS101"
                                                        : ""}
                                                    class="w-full border-none bg-transparent focus:ring-0 p-2 placeholder:text-slate-400"
                                                /></td
                                            >
                                            <td class="p-2"
                                                ><input
                                                    type="text"
                                                    placeholder="Intro to CS"
                                                    value={!isNew
                                                        ? "Intro to CS"
                                                        : ""}
                                                    class="w-full border-none bg-transparent focus:ring-0 p-2 placeholder:text-slate-400"
                                                /></td
                                            >
                                            <td class="p-2"
                                                ><input
                                                    type="text"
                                                    placeholder="COMP 101"
                                                    value={!isNew
                                                        ? "COMP 101"
                                                        : ""}
                                                    class="w-full border-none bg-transparent focus:ring-0 p-2 placeholder:text-slate-400"
                                                /></td
                                            >
                                            <td
                                                class="p-2 text-center text-slate-400 hover:text-red-500 cursor-pointer"
                                                ><span
                                                    class="material-symbols-outlined text- base"
                                                    >delete</span
                                                ></td
                                            >
                                        </tr>
                                    </tbody>
                                </table>
                                <button
                                    class="w-full py-2 bg-slate-50 dark:bg-slate-800/50 text-primary text-xs font-bold uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-t border-slate-200 dark:border-slate-800"
                                >
                                    + Add Course Row
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Documents -->
                <section id="documents" class="scroll-mt-6">
                    <h2
                        class="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"
                    >
                        <span
                            class="flex items-center justify-center size-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500"
                            >4</span
                        >
                        Documents & Essays
                    </h2>
                    <div
                        class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6"
                    >
                        <div>
                            <label
                                class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
                                >Statement of Purpose</label
                            >
                            <textarea
                                rows="6"
                                class="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary sm:text-sm"
                                placeholder="Why do you want to join this program? (Max 500 words)"
                            ></textarea>
                            <p class="text-xs text-slate-500 mt-2 text-right">
                                0 / 500 words
                            </p>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div
                                class="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                            >
                                <span
                                    class="material-symbols-outlined text-4xl text-slate-300 group-hover:text-primary transition-colors"
                                    >upload_file</span
                                >
                                <p
                                    class="text-sm font-bold text-slate-900 dark:text-white mt-3"
                                >
                                    Transcripts
                                </p>
                                <p class="text-xs text-slate-500 mt-1">
                                    PDF up to 5MB
                                </p>
                            </div>
                            <div
                                class="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                            >
                                <span
                                    class="material-symbols-outlined text-4xl text-slate-300 group-hover:text-primary transition-colors"
                                    >upload_file</span
                                >
                                <p
                                    class="text-sm font-bold text-slate-900 dark:text-white mt-3"
                                >
                                    CV / Resume
                                </p>
                                <p class="text-xs text-slate-500 mt-1">
                                    PDF up to 2MB
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <div class="h-16"></div>
                <!-- Spacer -->
            </div>
        </div>

        <!-- Right Chat Panel (Only for Submitted) -->
        {#if showChat}
            <aside
                class="w-80 shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shadow-xl z-20 fixed inset-y-0 right-0 pt-16 xl:pt-0 xl:static"
            >
                <div
                    class="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between"
                >
                    <h3
                        class="font-bold text-slate-900 dark:text-white text-sm"
                    >
                        App Correspondence
                    </h3>
                    <button
                        class="size-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 cursor-pointer hover:bg-slate-200 transition-colors"
                        title="Close Chat"
                        on:click={() => (showChat = false)}
                    >
                        <span class="material-symbols-outlined text-sm"
                            >close</span
                        >
                    </button>
                </div>
                <!-- Messages -->
                <div
                    class="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/50"
                >
                    {#each chatMessages as msg}
                        <div
                            class="flex flex-col {msg.isMe
                                ? 'items-end'
                                : 'items-start'}"
                        >
                            <div
                                class="max-w-[85%] rounded-2xl px-4 py-2 text-xs {msg.isMe
                                    ? 'bg-primary text-white rounded-br-none'
                                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-bl-none shadow-sm'}"
                            >
                                {msg.text}
                            </div>
                            <span class="text-[10px] text-slate-400 mt-1 px-1">
                                {msg.sender} • {msg.time}
                            </span>
                        </div>
                    {/each}
                </div>
                <!-- Input -->
                <div
                    class="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                >
                    <div class="flex gap-2">
                        <input
                            type="text"
                            bind:value={newMessage}
                            placeholder="Type a message..."
                            class="flex-1 rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-primary focus:border-primary"
                            on:keydown={(e) =>
                                e.key === "Enter" && sendMessage()}
                        />
                        <button
                            class="p-2 rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors"
                            on:click={sendMessage}
                        >
                            <span class="material-symbols-outlined text-sm"
                                >send</span
                            >
                        </button>
                    </div>
                </div>
            </aside>
        {/if}
    </div>
</div>

<!-- Sticky Bottom Bar -->
<div
    class="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 z-40 lg:pl-64"
>
    <div class="max-w-3xl mx-auto flex items-center justify-between">
        <p class="text-xs text-slate-500">
            {isNew ? "Draft saved just now" : "Last saved: Oct 24, 10:42 AM"}
        </p>
        <div class="flex gap-3">
            {#if !isNew}
                <button
                    class="xl:hidden px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm bg-slate-50 dark:bg-slate-800 flex items-center gap-2"
                    on:click={() => (showChat = !showChat)}
                >
                    <span class="material-symbols-outlined text-sm">chat</span>
                    {showChat ? "Hide Chat" : "Show Chat"}
                </button>
            {/if}

            <button
                class="px-6 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
                {isNew ? "Save Draft" : "Update Application"}
            </button>
            {#if isNew}
                <button
                    class="px-6 py-2.5 rounded-lg bg-primary text-white font-bold text-sm hover:bg-green-600 transition-colors shadow-lg shadow-primary/20"
                >
                    Submit
                </button>
            {/if}
        </div>
    </div>
</div>
