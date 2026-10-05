import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { getAppConfig, type AppConfigResponse, ClientError } from "@/lib/api";
import { networkBadge } from "@/lib/networkBadge";
import { useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface NetworkBadgeProps {
  className?: string;
}

export const NetworkBadge: React.FC<NetworkBadgeProps> = ({ className }) => {
  const shouldReduceMotion = useReducedMotion();

  const { data: appConfig } = useQuery<AppConfigResponse, ClientError>({
    queryKey: ["appConfig"],
    queryFn: getAppConfig
  });

  const config = networkBadge(appConfig?.network);

  if (!config.label) {
    return null;
  }

  const toneClasses =
    config.tone === "warning"
      ? "bg-accent/15 text-accent"
      : "bg-muted text-muted-foreground";

  if (shouldReduceMotion) {
    return (
      <span
        aria-label={`Network: ${config.label}`}
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight select-none",
          toneClasses,
          className
        )}
      >
        {config.label}
      </span>
    );
  }

  return (
    <motion.span
      key={config.label}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.15, ease: "easeOut" } }}
      aria-label={`Network: ${config.label}`}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight select-none",
        toneClasses,
        className
      )}
    >
      {config.label}
    </motion.span>
  );
};
