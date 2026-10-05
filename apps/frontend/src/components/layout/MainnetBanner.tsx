import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { getAppConfig, type AppConfigResponse, ClientError } from "@/lib/api";
import { useReducedMotion } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "kepler.mainnetNoticeDismissed";

const bannerVariants: Variants = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: "easeIn" } }
};

const reducedVariants: Variants = {
  initial: { opacity: 1 },
  animate: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } }
};

export interface MainnetBannerProps {
  className?: string;
}

export const MainnetBanner: React.FC<MainnetBannerProps> = ({ className }) => {
  const shouldReduceMotion = useReducedMotion();

  const { data: appConfig } = useQuery<AppConfigResponse, ClientError>({
    queryKey: ["appConfig"],
    queryFn: getAppConfig
  });

  const network = appConfig?.network;
  const isMainnet = (network ?? "").toLowerCase() === "mainnet";

  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!network) {
      return;
    }
    if (network.toLowerCase() !== "mainnet") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        return;
      }
      setIsDismissed(false);
    } else {
      try {
        setIsDismissed(window.localStorage.getItem(STORAGE_KEY) === "true");
      } catch {
        setIsDismissed(false);
      }
    }
  }, [network]);

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      return;
    }
    setIsDismissed(true);
  };

  const isVisible = isMainnet && !isDismissed;

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          key="mainnet-banner"
          variants={shouldReduceMotion ? reducedVariants : bannerVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          role="status"
          aria-live="polite"
          className={cn(
            "w-full flex items-center justify-between gap-4 rounded-[12px] border border-amber-500/30 bg-card px-5 py-3.5 mb-6",
            className
          )}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
              aria-hidden="true"
            />
            <p className="font-sans text-body text-foreground">
              You are on Bitcoin mainnet. Payments use real funds.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="shrink-0"
          >
            Got it
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
