import type { ReactNode } from "react";
import { Check } from "lucide-react";

export type StepStatus = "active" | "upcoming" | "complete";

export interface Step {
  number: number;
  title: string;
  status: StepStatus;
  content?: ReactNode;
  onHeaderClick?: () => void;
}

interface StepperProps {
  steps: Step[];
}

export function Stepper({ steps }: StepperProps) {
  return (
    <div className="flex flex-col">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isActive = step.status === "active";
        const isComplete = step.status === "complete";

        return (
          <div key={step.number} className="flex gap-2">
            <div className="flex flex-col items-center">
              {isComplete ? (
                <div className="w-8 h-8 rounded-full bg-[#1f7a3a] flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5 text-white" strokeWidth={3} />
                </div>
              ) : (
                <div
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center bg-white font-bold text-[16px] shrink-0 ${
                    isActive ? "border-[#2a2b2d] text-[#2a2b2d]" : "border-[#4c4e52] text-[#4c4e52]"
                  }`}
                >
                  {step.number}
                </div>
              )}
              {!isLast && <div className="flex-1 w-0.5 bg-[#4c4e52] min-h-[24px]" />}
            </div>

            <div className="flex-1 pb-8">
              <div className="pt-1">
                {isActive && (
                  <div className="text-[#4c4e52] leading-6">
                    Steg {step.number} av {steps.length}
                  </div>
                )}
                {isComplete ? (
                  <button
                    onClick={step.onHeaderClick}
                    className="font-semibold text-[#005299] underline text-[16px] leading-6 hover:text-[#003d73]"
                  >
                    {step.title}
                  </button>
                ) : (
                  <div
                    className={`font-bold text-[16px] leading-6 ${
                      isActive ? "text-[#2a2b2d]" : "text-[#4c4e52]"
                    }`}
                  >
                    {step.title}
                  </div>
                )}
              </div>
              {isActive && step.content && <div className="pt-4">{step.content}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
