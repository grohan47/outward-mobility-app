import React from 'react';

export default function StudentMessages() {
    return (
        <div className="h-[calc(100vh-140px)] flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <input
                        placeholder="Search messages..."
                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-500 focus:ring-1 focus:ring-primary"
                    />
                </div>
                <div className="flex-1 overflow-y-auto">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-primary/5 cursor-pointer">
                        <div className="flex justify-between mb-1">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">OGE Office</span>
                            <span className="text-[10px] text-primary font-bold">10:42 AM</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium truncate">Re: Missing Document - Grade Sheet</p>
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">Please upload the original scanned copy...</p>
                    </div>
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                        <div className="flex justify-between mb-1">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">Dr. Sarah Jenkins</span>
                            <span className="text-[10px] text-slate-400">Yesterday</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate">Interview Confirmation</p>
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">Thanks for scheduling. I'll see you on Monday.</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">OGE Office</h4>
                        <p className="text-xs text-slate-500">Ticket #9928 • Response time: &lt; 2 hrs</p>
                    </div>
                    <button className="text-slate-400 hover:text-primary">
                        <span className="material-symbols-outlined">info</span>
                    </button>
                </div>
                <div className="flex-1 p-6 overflow-y-auto space-y-6">
                    <div className="flex gap-3">
                        <div className="size-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">OG</div>
                        <div className="max-w-[80%]">
                            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-tr-xl rounded-br-xl rounded-bl-xl text-sm text-slate-700 dark:text-slate-300">
                                Hi Aditya, we noticed the Grade Sheet you uploaded is blurry. Could you please re-upload a high-res scan?
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 ml-1">10:30 AM</span>
                        </div>
                    </div>
                    <div className="flex gap-3 flex-row-reverse">
                        <div className="size-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">ME</div>
                        <div className="max-w-[80%]">
                            <div className="bg-primary/10 p-3 rounded-tl-xl rounded-tr-xl rounded-bl-xl text-sm text-slate-900 dark:text-white">
                                Sure, I will upload it by this evening. Do I need to re-submit the whole application?
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 mr-1 text-right block">10:35 AM</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="size-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">OG</div>
                        <div className="max-w-[80%]">
                            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-tr-xl rounded-br-xl rounded-bl-xl text-sm text-slate-700 dark:text-slate-300">
                                No, just use the 'Upload File' button on your dashboard prompt.
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 ml-1">10:42 AM</span>
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex gap-2">
                        <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                            <span className="material-symbols-outlined">attach_file</span>
                        </button>
                        <input
                            className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-full px-4 text-sm focus:ring-1 focus:ring-primary"
                            placeholder="Type a message..."
                        />
                        <button className="p-2 bg-primary text-white rounded-full hover:shadow-lg">
                            <span className="material-symbols-outlined text-[20px]">send</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}