import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export interface TooltipContentProps
  extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> {}

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(({ className, sideOffset = 4, children, ...props }, ref) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        asChild
        {...props}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: { duration: shouldReduceMotion ? 0.01 : 0.12, ease: "easeOut" }
          }}
          exit={{
            opacity: 0,
            transition: { duration: shouldReduceMotion ? 0.01 : 0.1, ease: "easeIn" }
          }}
          className={cn(
            "z-50 overflow-hidden rounded-md border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground shadow-none select-none",
            className
          )}
        >
          {children}
        </motion.div>
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
});

TooltipContent.displayName = TooltipPrimitive.Content.displayName;
