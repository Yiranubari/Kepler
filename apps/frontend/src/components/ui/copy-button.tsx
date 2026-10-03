import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Copy, Check } from "lucide-react";
import { useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface CopyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  ariaLabel?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  value,
  ariaLabel = "Copy to clipboard",
  className,
  ...props
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const shouldReduceMotion = useReducedMotion();

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 600);
    } catch {
      return;
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="check"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.15 } }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
            className="flex items-center justify-center"
          >
            <Check className="w-4 h-4 text-accent" aria-hidden="true" />
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.15 } }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
            className="flex items-center justify-center"
          >
            <Copy className="w-4 h-4" aria-hidden="true" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
};
