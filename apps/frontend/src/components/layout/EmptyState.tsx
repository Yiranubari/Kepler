import React from "react";
import { motion } from "motion/react";
import { fadeInUp, useReducedMotion } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={fadeInUp}
      initial={shouldReduceMotion ? { opacity: 0 } : "initial"}
      animate={shouldReduceMotion ? { opacity: 1 } : "animate"}
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-lg border border-border/40 bg-card/40 my-6 max-w-lg mx-auto w-full",
        className
      )}
    >
      {Icon && (
        <div className="p-3 rounded-full bg-secondary/60 text-muted-foreground mb-4">
          <Icon className="w-6 h-6" />
        </div>
      )}
      {title && (
        <h3 className="text-base font-semibold text-foreground mb-1">
          {title}
        </h3>
      )}
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
};
