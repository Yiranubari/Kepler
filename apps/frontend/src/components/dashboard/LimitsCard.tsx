import React from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Policy } from "@kepler/shared";
import type { ClientError } from "@/lib/api";
import { FALLBACK_ERROR_MESSAGE } from "@/lib/errorMessages";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { useReducedMotion } from "@/lib/motion";

export interface LimitsCardProps {
  policy: Policy | undefined;
  isLoading: boolean;
  error: ClientError | null;
  onRetry: () => void;
}

export const LimitsCard: React.FC<LimitsCardProps> = ({
  policy,
  isLoading,
  error,
  onRetry
}) => {
  const shouldReduceMotion = useReducedMotion();
  const friendlyMessage = error ? error.friendlyMessage : FALLBACK_ERROR_MESSAGE;

  return (
    <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none h-full flex flex-col justify-between">
      <div>
        <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground mb-6">
          Your limits
        </h2>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2, ease: "easeOut" } }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.1, ease: "easeIn" } }}
              className="space-y-4 my-6"
              aria-busy="true"
              aria-label="Checking your limits..."
            >
              <div className="flex items-center justify-between py-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex items-center justify-between py-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-24" />
              </div>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2, ease: "easeOut" } }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.1, ease: "easeIn" } }}
              className="space-y-3 py-4"
            >
              <p className="text-sm font-sans text-muted-foreground">{friendlyMessage}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
              >
                Try again
              </Button>
            </motion.div>
          ) : policy ? (
            <motion.div
              key="content"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2, ease: "easeOut" } }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.1, ease: "easeIn" } }}
              className="space-y-4 my-6"
            >
              <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                <span className="text-sm font-sans text-muted-foreground">
                  Daily remaining budget
                </span>
                <span className="font-display font-medium tabular-nums text-sm text-foreground">
                  <AnimatedNumber value={policy.dailyBudgetSats} /> sats
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm font-sans text-muted-foreground">
                  Per-transaction limit
                </span>
                <span className="font-display font-medium tabular-nums text-sm text-foreground">
                  <AnimatedNumber value={policy.perTxBudgetSats} /> sats
                </span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="pt-4 border-t border-white/[0.04]">
        <Link
          to="/app/settings"
          className="text-sm font-sans font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
        >
          Manage limits in Settings
        </Link>
      </div>
    </Card>
  );
};
