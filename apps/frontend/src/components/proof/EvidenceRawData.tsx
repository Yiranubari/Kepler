import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { fadeIn, useReducedMotion } from "@/lib/motion";
import { type EvidenceBundleWire } from "@/lib/api";

export interface EvidenceRawDataProps {
  refs: EvidenceBundleWire["rawDataRefs"];
}

function truncateRef(value: string): string {
  if (value.length <= 20) {
    return value;
  }
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

export const EvidenceRawData: React.FC<EvidenceRawDataProps> = ({ refs }) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className="w-fit"
      >
        {expanded ? "Hide raw data" : "Show raw data"}
      </Button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            variants={fadeIn}
            initial={shouldReduceMotion ? { opacity: 1 } : "initial"}
            animate={shouldReduceMotion ? { opacity: 1 } : "animate"}
            exit={shouldReduceMotion ? { opacity: 0 } : "exit"}
            className="space-y-4"
          >
            {refs.map((ref, index) => (
              <div
                key={`${ref.source}-${ref.ref}-${index}`}
                className="space-y-2 rounded-[8px] border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-sans text-body font-medium text-foreground">
                    {ref.source}
                  </span>
                  <span className="font-mono text-body-sm text-muted-foreground text-right break-all">
                    {truncateRef(ref.ref)}
                  </span>
                </div>
                <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap break-all max-h-[240px] overflow-y-auto">
                  {JSON.stringify(ref.payload, null, 2)}
                </pre>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
