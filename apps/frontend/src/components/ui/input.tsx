import React, { useId, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShakeOnError } from "@/components/motion/ShakeOnError";
import { Label } from "@/components/ui/label";
import { fadeIn, useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id: customId,
      label,
      error,
      className,
      containerClassName,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = customId ?? generatedId;
    const [isFocused, setIsFocused] = useState<boolean>(false);
    const shouldReduceMotion = useReducedMotion();

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(event);
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(event);
    };

    return (
      <div className={cn("flex flex-col gap-1.5 w-full", containerClassName)}>
        {label && (
          <Label
            htmlFor={inputId}
            className={cn(
              "transition-colors duration-150",
              isFocused ? "text-accent" : "text-muted-foreground",
              Boolean(error) && "text-destructive"
            )}
          >
            {label}
          </Label>
        )}
        <ShakeOnError errorKey={error}>
          <input
            id={inputId}
            ref={ref}
            onFocus={handleFocus}
            onBlur={handleBlur}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={cn(
              "flex h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 transition-[border-color,box-shadow] duration-150 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              error
                ? "border-destructive focus-visible:ring-1 focus-visible:ring-destructive"
                : isFocused
                ? "border-foreground/50 ring-1 ring-foreground/20"
                : "border-border/60 hover:border-border",
              className
            )}
            {...props}
          />
        </ShakeOnError>
        <AnimatePresence>
          {error && (
            <motion.div
              id={`${inputId}-error`}
              role="alert"
              variants={fadeIn}
              initial={shouldReduceMotion ? { opacity: 0 } : "initial"}
              animate={shouldReduceMotion ? { opacity: 1 } : "animate"}
              exit={shouldReduceMotion ? { opacity: 0 } : "exit"}
              className="text-xs text-destructive font-medium mt-0.5"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

Input.displayName = "Input";
