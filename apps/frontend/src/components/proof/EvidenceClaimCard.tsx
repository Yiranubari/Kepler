import React from "react";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { fadeInUp, useReducedMotion } from "@/lib/motion";
import { type EvidenceBundleWire } from "@/lib/api";

export interface EvidenceClaimCardProps {
  bundle: EvidenceBundleWire;
}

export function claimTypeLabel(type: string): string {
  if (type === "Privacy") return "Privacy check";
  if (type === "Transaction") return "Payment record";
  if (type === "Routing") return "Route decision";
  if (type === "Nostr") return "Public note";
  return "Claim";
}

function truncateHash(value: string): string {
  if (value.length <= 20) {
    return value;
  }
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

export const EvidenceClaimCard: React.FC<EvidenceClaimCardProps> = ({
  bundle
}) => {
  const shouldReduceMotion = useReducedMotion();
  const confidencePercent =
    bundle.confidence === null ? null : Math.round(bundle.confidence * 100);

  return (
    <motion.div
      variants={fadeInUp}
      initial={shouldReduceMotion ? { opacity: 0 } : "initial"}
      animate={shouldReduceMotion ? { opacity: 1 } : "animate"}
    >
      <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-4">
        <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground">
          Claim
        </h2>

        <p className="font-sans text-body text-foreground leading-relaxed">
          {bundle.claim.text}
        </p>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex flex-col gap-1">
            <span className="font-sans text-label-caps uppercase text-muted-foreground font-semibold">
              Type
            </span>
            <span className="font-sans text-body-sm text-foreground">
              {claimTypeLabel(bundle.claim.type)}
            </span>
          </div>

          {confidencePercent !== null && (
            <div className="flex flex-col gap-1">
              <span className="font-sans text-label-caps uppercase text-muted-foreground font-semibold">
                Confidence
              </span>
              <span className="font-display font-medium text-body text-foreground tabular-nums">
                <AnimatedNumber
                  value={confidencePercent}
                  formatFn={(val) => `${val}%`}
                />
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-white/[0.08] pt-4">
          <span className="font-sans text-body-sm text-muted-foreground">
            Bundle ID
          </span>
          <span className="font-mono text-body-sm text-foreground break-all">
            {truncateHash(bundle.bundleHash)}
          </span>
          <CopyButton value={bundle.bundleHash} ariaLabel="Copy bundle ID" />
        </div>
      </Card>
    </motion.div>
  );
};
