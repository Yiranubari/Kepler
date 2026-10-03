import React from "react";
import { motion } from "motion/react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientError } from "@/lib/api";
import { FALLBACK_ERROR_MESSAGE } from "@/lib/errorMessages";
import { useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  onRetry,
  className
}) => {
  const shouldReduceMotion = useReducedMotion();

  let message = FALLBACK_ERROR_MESSAGE;
  if (error instanceof ClientError) {
    message = error.friendlyMessage;
  } else if (typeof error === "string") {
    message = error;
  }

  const shakeAnimation = shouldReduceMotion
    ? { opacity: 1, y: 0 }
    : {
        opacity: 1,
        y: 0,
        x: [0, -4, 4, -4, 4, 0],
        transition: {
          y: { duration: 0.2, ease: "easeOut" },
          opacity: { duration: 0.2, ease: "easeOut" },
          x: { duration: 0.2, ease: "easeInOut" }
        }
      };

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, x: 0 }}
      animate={shakeAnimation}
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-lg border border-destructive/40 bg-card/60 my-6 max-w-lg mx-auto w-full",
        className
      )}
    >
      <div className="p-3 rounded-full bg-destructive/10 text-destructive mb-4">
        <AlertCircle className="w-6 h-6" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-foreground max-w-sm mb-6">
        {message}
      </p>
      {onRetry && (
        <Button variant="secondary" size="md" onClick={onRetry}>
          Try again
        </Button>
      )}
    </motion.div>
  );
};
