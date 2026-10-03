import React from "react";
import { AnimatePresence, motion } from "motion/react";
import type { ClientError } from "@/lib/api";
import { FALLBACK_ERROR_MESSAGE } from "@/lib/errorMessages";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReducedMotion } from "@/lib/motion";
import { networkLabel } from "@/lib/networkLabel";

export interface NetworkCardProps {
  network: string;
  isLoading: boolean;
  error?: ClientError | null;
  onRetry?: () => void;
}

export const NetworkCard: React.FC<NetworkCardProps> = ({
  network,
  isLoading,
  error,
  onRetry
}) => {
  const shouldReduceMotion = useReducedMotion();
  const friendlyMessage = error ? error.friendlyMessage : FALLBACK_ERROR_MESSAGE;
  const isProtocolError = Boolean(error && error.code !== "SERVICE_UNAVAILABLE");

  return (
    <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none h-full flex flex-col justify-between">
      <div>
        <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground mb-4">
          Network
        </h2>

        <p className="font-sans text-body text-muted-foreground mb-6">
          {networkLabel(network)}
        </p>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2, ease: "easeOut" } }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.1, ease: "easeIn" } }}
              className="space-y-2 py-1"
              aria-busy="true"
              aria-label="Checking network connection..."
            >
              <Skeleton className="h-4 w-28" />
            </motion.div>
          ) : isProtocolError && onRetry ? (
            <motion.div
              key="error"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2, ease: "easeOut" } }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.1, ease: "easeIn" } }}
              className="space-y-2 pt-2"
            >
              <p className="text-xs font-sans text-muted-foreground">
                {friendlyMessage}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
              >
                Try again
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </Card>
  );
};
