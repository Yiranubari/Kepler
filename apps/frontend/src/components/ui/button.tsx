import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "motion/react";
import { useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium transition-[box-shadow,color,background-color,border-color] duration-120 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground rounded-full hover:bg-primary/90 hover:border-white/20 border border-transparent",
        secondary: "bg-secondary text-secondary-foreground rounded-md border border-border/60 hover:bg-secondary/80 hover:border-border",
        outline: "border border-border bg-transparent text-foreground hover:bg-secondary hover:text-foreground rounded-md",
        ghost: "bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40 rounded-md",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md"
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", whileTap, whileHover, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    const hoverAnimation = shouldReduceMotion
      ? undefined
      : variant === "primary" || variant === "secondary"
      ? { y: -1 }
      : undefined;

    const tapAnimation = shouldReduceMotion
      ? undefined
      : { scale: 0.97, transition: { duration: 0.1 } };

    return (
      <motion.button
        ref={ref}
        whileHover={whileHover ?? hoverAnimation}
        whileTap={whileTap ?? tapAnimation}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
