import React from "react";
import { motion } from "motion/react";
import { fadeInUp, useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  action,
  className
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={fadeInUp}
      initial={shouldReduceMotion ? { opacity: 0 } : "initial"}
      animate={shouldReduceMotion ? { opacity: 1 } : "animate"}
      className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8", className)}
    >
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </motion.div>
  );
};
