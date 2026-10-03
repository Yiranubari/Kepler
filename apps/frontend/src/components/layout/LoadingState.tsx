import React from "react";
import { motion } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  statusText: string;
  className?: string;
  cardsCount?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  statusText,
  className,
  cardsCount = 3
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.15 } }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
      className={cn("w-full space-y-4 my-6", className)}
    >
      <div className="flex items-center gap-3 py-2" role="status" aria-live="polite">
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <span className="text-sm text-muted-foreground font-medium">
          {statusText}
        </span>
      </div>
      <div className="space-y-3">
        {Array.from({ length: cardsCount }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    </motion.div>
  );
};
