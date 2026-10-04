import React from "react";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { DotShield, DotCheck } from "@/components/visual/icons";
import { listContainer, listItem, useReducedMotion } from "@/lib/motion";
import { type EvidenceBundleWire } from "@/lib/api";

export interface EvidenceStepsProps {
  steps: EvidenceBundleWire["verificationSteps"];
}

export function humanizeStepName(name: string): string {
  const normalized = name
    .replace(/[_:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (normalized.length === 0) {
    return "";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export const EvidenceSteps: React.FC<EvidenceStepsProps> = ({ steps }) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-4">
      <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground">
        How this is checked
      </h2>

      <motion.div
        variants={shouldReduceMotion ? undefined : listContainer(0.04)}
        initial={shouldReduceMotion ? false : "initial"}
        animate="animate"
        className="space-y-3"
      >
        {steps.map((step, index) => {
          const StepIcon = index === 0 ? DotShield : DotCheck;
          return (
            <motion.div
              key={`${step.name}-${index}`}
              variants={listItem}
              className="flex items-center gap-3"
            >
              <StepIcon
                size={24}
                aria-hidden="true"
                className="shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 flex-1 font-sans text-body text-foreground">
                {humanizeStepName(step.name)}
              </span>
              <span className="text-right font-sans text-body-sm text-muted-foreground">
                {step.endpoint}
              </span>
            </motion.div>
          );
        })}
      </motion.div>
    </Card>
  );
};
