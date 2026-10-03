import React, { useEffect, useRef } from "react";
import { motion, useAnimationControls } from "motion/react";
import { statusPulse, useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type StatusBadgeValue =
  | "PENDING"
  | "ANALYZED"
  | "DECIDED"
  | "EXECUTED"
  | "FAILED"
  | string;

export interface StatusBadgeProps {
  status: StatusBadgeValue;
  className?: string;
}

const statusStyles: Record<string, string> = {
  PENDING: "bg-secondary text-muted-foreground border-border/80",
  ANALYZED: "bg-blue-950/40 text-blue-400 border-blue-900/60",
  DECIDED: "bg-amber-950/40 text-amber-400 border-amber-900/60",
  EXECUTED: "bg-accent/15 text-accent border-accent/40",
  FAILED: "bg-destructive/15 text-destructive border-destructive/40"
};

const statusLabels: Record<string, string> = {
  PENDING: "Pending",
  ANALYZED: "Analyzed",
  DECIDED: "Decided",
  EXECUTED: "Executed",
  FAILED: "Failed"
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const controls = useAnimationControls();
  const shouldReduceMotion = useReducedMotion();
  const previousStatusRef = useRef<string>(status);

  useEffect(() => {
    if (previousStatusRef.current !== status) {
      previousStatusRef.current = status;
      if (!shouldReduceMotion) {
        void controls.start("pulse");
      }
    }
  }, [status, controls, shouldReduceMotion]);

  const upper = status.toUpperCase();
  const style = statusStyles[upper] ?? "bg-secondary text-foreground border-border";
  const label = statusLabels[upper] ?? status;

  if (shouldReduceMotion) {
    return (
      <span
        className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors duration-200 select-none",
          style,
          className
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <motion.span
      variants={statusPulse}
      initial="initial"
      animate={controls}
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors duration-200 select-none",
        style,
        className
      )}
    >
      {label}
    </motion.span>
  );
};
