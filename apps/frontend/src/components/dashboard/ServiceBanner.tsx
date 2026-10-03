import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { fadeInDown, useReducedMotion } from "@/lib/motion";

export interface ServiceBannerProps {
  visible: boolean;
  onRetry: () => void;
}

export const ServiceBanner: React.FC<ServiceBannerProps> = ({
  visible,
  onRetry
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="service-banner"
          variants={shouldReduceMotion ? undefined : fadeInDown}
          initial={shouldReduceMotion ? { opacity: 1 } : "initial"}
          animate={shouldReduceMotion ? { opacity: 1 } : "animate"}
          exit={shouldReduceMotion ? { opacity: 0 } : "exit"}
          className="w-full flex items-center justify-between gap-4 rounded-[12px] border border-destructive/40 bg-card px-5 py-4"
          role="alert"
        >
          <div className="flex items-center gap-3">
            <span
              className="w-2 h-2 rounded-full bg-destructive shrink-0"
              aria-hidden="true"
            />
            <p className="font-sans text-body font-medium text-foreground">
              Kepler is having trouble right now. Try again in a moment.
            </p>
          </div>
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
  );
};
