import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { stepForward, stepBackward, useReducedMotion } from "@/lib/motion";

export interface StepTransitionProps {
  stepKey: string | number;
  direction?: "forward" | "backward";
  children: React.ReactNode;
  className?: string;
}

export const StepTransition: React.FC<StepTransitionProps> = ({
  stepKey,
  direction = "forward",
  children,
  className
}) => {
  const shouldReduceMotion = useReducedMotion();
  const activeVariant = direction === "backward" ? stepBackward : stepForward;

  if (shouldReduceMotion) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={stepKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.15 } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          className={className}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        variants={activeVariant}
        initial="initial"
        animate="animate"
        exit="exit"
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
