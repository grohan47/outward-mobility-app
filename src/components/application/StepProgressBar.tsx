import React from "react";

export function StepProgressBar({
  stages,
  currentStage,
  finalStatus,
}: {
  stages: { code: string; label: string }[];
  currentStage: string;
  finalStatus?: string | null;
}) {
  const currentIndex = stages.findIndex((s) => s.code === currentStage);
  
  // If CLOSED and finalStatus == REJECTED, color everything red from rejection point
  // For simplicity MVP, we just show a completed track, or a rejected track.
  const isRejected = currentStage === "CLOSED" && finalStatus === "REJECTED";
  const isCompleted = currentStage === "CLOSED" && finalStatus === "APPROVED";

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 -z-10 rounded-full" />
        
        {/* Progress Fill */}
        <div 
          className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 -z-10 rounded-full transition-all duration-500 ease-in-out ${
            isRejected ? "bg-red-500" : "bg-primary"
          }`}
          style={{ width: `${(Math.max(0, isCompleted || isRejected ? stages.length - 1 : currentIndex) / (stages.length - 1)) * 100}%` }}
        />

        {stages.map((stage, idx) => {
          const isPassed = isCompleted || isRejected || idx < currentIndex;
          const isActive = !isCompleted && !isRejected && idx === currentIndex;
          
          let circleColor = "bg-white border-2 border-slate-200 text-slate-300";
          if (isPassed) {
            circleColor = isRejected ? "bg-red-500 border-2 border-red-500 text-white" : "bg-primary border-2 border-primary text-white";
          } else if (isActive) {
            circleColor = "bg-white border-4 border-primary text-primary shadow-lg shadow-primary/20";
          }

          return (
            <div key={stage.code} className="flex flex-col items-center gap-2 group relative">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors duration-300 ${circleColor} ${isActive ? 'scale-110' : ''}`}
              >
                {isPassed ? (
                  <span className="material-symbols-outlined text-[16px] font-bold">
                    {isRejected ? 'close' : 'check'}
                  </span>
                ) : (
                  idx + 1
                )}
              </div>
              
              {/* Tooltip-style label for MVP minimalism */}
              <div className={`absolute top-10 whitespace-nowrap text-[11px] font-bold uppercase tracking-wider transition-opacity ${isActive ? 'text-primary' : isPassed ? (isRejected ? 'text-red-500' : 'text-slate-600') : 'text-slate-400 opacity-0 group-hover:opacity-100'}`}>
                {stage.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
