import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle } from "lucide-react";
import { Scenario } from "@kepler/shared";
import type { ClientError } from "@/lib/api";
import { FALLBACK_ERROR_MESSAGE } from "@/lib/errorMessages";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DotClock } from "@/components/visual/icons/DotClock";
import { ActivityRow } from "@/components/dashboard/ActivityRow";
import { listContainer, useReducedMotion } from "@/lib/motion";

export interface ActivityCardProps {
  scenarios: Scenario[] | undefined;
  isLoading: boolean;
  error: ClientError | null;
  onRetry: () => void;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({
  scenarios,
  isLoading,
  error,
  onRetry
}) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const recentScenarios = scenarios ? scenarios.slice(0, 5) : [];
  const friendlyMessage = error ? error.friendlyMessage : FALLBACK_ERROR_MESSAGE;

  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground">
          Recent activity
        </h2>
        <Link
          to="/app/history"
          className="text-sm font-sans font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
        >
          View all
        </Link>
      </div>

      <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2, ease: "easeOut" } }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.1, ease: "easeIn" } }}
              className="space-y-4"
              aria-busy="true"
              aria-label="Checking your payments..."
            >
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-4 w-28 sm:w-44" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2, ease: "easeOut" } }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.1, ease: "easeIn" } }}
              className="flex flex-col items-center justify-center text-center py-8"
            >
              <div className="p-3 rounded-full bg-destructive/10 text-destructive mb-4">
                <AlertCircle className="w-6 h-6" aria-hidden="true" />
              </div>
              <p className="text-sm font-sans font-medium text-foreground max-w-sm mb-4">
                {friendlyMessage}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
              >
                Try again
              </Button>
            </motion.div>
          ) : recentScenarios.length === 0 ? (
            <motion.div
              key="empty"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2, ease: "easeOut" } }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.1, ease: "easeIn" } }}
              className="flex flex-col items-center justify-center text-center py-8"
            >
              <div className="p-4 rounded-full bg-secondary/40 text-muted-foreground mb-4">
                <DotClock size={40} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-sans text-muted-foreground max-w-sm mb-6">
                Nothing here yet. Make your first payment to see it.
              </p>
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate("/app/send")}
              >
                Start a payment
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              variants={shouldReduceMotion ? undefined : listContainer(0.04)}
              initial={shouldReduceMotion ? { opacity: 1 } : "initial"}
              animate={shouldReduceMotion ? { opacity: 1 } : "animate"}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.1, ease: "easeIn" } }}
              className="divide-y divide-white/[0.06]"
            >
              {recentScenarios.map((scenario, index) => (
                <ActivityRow
                  key={scenario.id}
                  scenario={scenario}
                  index={index}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </section>
  );
};
