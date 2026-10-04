import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { getScenario, type ScenarioResponse, ClientError } from "@/lib/api";
import { networkLabel } from "@/lib/networkLabel";
import { EmptyState } from "@/components/layout/EmptyState";
import { ErrorState } from "@/components/layout/ErrorState";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { DotClock } from "@/components/visual/icons/DotClock";
import { DotShield } from "@/components/visual/icons/DotShield";
import { fadeInUp, useReducedMotion } from "@/lib/motion";

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffInSeconds < 60) {
    return "just now";
  }
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays}d ago`;
  }
  return date.toLocaleDateString();
};

export const HistoryDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const {
    data: scenario,
    isLoading,
    error,
    refetch
  } = useQuery<ScenarioResponse, ClientError>({
    queryKey: ["scenario", id],
    queryFn: () => {
      if (!id) {
        throw new Error("Missing payment identifier");
      }
      return getScenario(id);
    },
    enabled: Boolean(id)
  });

  const truncatedId = id
    ? id.length > 20
      ? `${id.slice(0, 10)}...${id.slice(-8)}`
      : id
    : "";

  const isNotFoundError = error && (error.code === "NOT_FOUND" || error.code === "SCENARIO_NOT_FOUND");

  const targetString = scenario
    ? typeof scenario.target.payload.invoice === "string"
      ? scenario.target.payload.invoice
      : typeof scenario.target.payload.address === "string"
      ? scenario.target.payload.address
      : typeof scenario.target.payload.mint === "string"
      ? scenario.target.payload.mint
      : typeof scenario.target.payload.request === "string"
      ? scenario.target.payload.request
      : typeof scenario.target.payload.destination === "string"
      ? scenario.target.payload.destination
      : ""
    : "";

  const getAmountSats = (): number | null => {
    if (!scenario) return null;
    if (
      typeof scenario.target.payload.amountSats === "number" ||
      typeof scenario.target.payload.amountSats === "string"
    ) {
      const parsed = Number(scenario.target.payload.amountSats);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    if (
      typeof scenario.target.payload.amountMsat === "number" ||
      typeof scenario.target.payload.amountMsat === "string"
    ) {
      const parsed = Math.floor(Number(scenario.target.payload.amountMsat) / 1000);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return null;
  };

  const amountSats = getAmountSats();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.15, ease: "easeOut" } }}
      className="w-full space-y-8 md:space-y-12 max-w-3xl"
    >
      {isLoading ? (
        <div className="space-y-8">
          <div className="space-y-2 mb-8">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="w-full py-6 border-y border-white/[0.08] flex items-center justify-between">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-4">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
          </Card>
        </div>
      ) : isNotFoundError || (!scenario && !error) ? (
        <EmptyState
          icon={DotClock}
          title="Payment not found"
          description="We could not find this payment. Check your history."
          actionLabel="Back to history"
          onAction={() => navigate("/app/history")}
        />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : scenario ? (
        <>
          <div className="space-y-2">
            <h1 className="font-display text-heading-1 font-bold tracking-[-0.02em] text-foreground">
              Payment details
            </h1>
            <p className="font-mono text-sm text-muted-foreground">
              {truncatedId}
            </p>
          </div>

          <motion.div
            variants={fadeInUp}
            initial={shouldReduceMotion ? { opacity: 0 } : "initial"}
            animate={shouldReduceMotion ? { opacity: 1 } : "animate"}
            className="w-full py-6 border-y border-white/[0.08] flex items-center justify-between"
          >
            <StatusBadge status={scenario.status} />
            <span className="font-sans text-xs text-muted-foreground">
              {formatRelativeTime(scenario.createdAt)}
            </span>
          </motion.div>

          <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-4 divide-y divide-white/[0.06]">
            <div className="flex flex-col gap-1 text-left first:pt-0">
              <span className="font-sans text-label-caps uppercase text-muted-foreground font-semibold">
                Target
              </span>
              <div className="flex items-center gap-2">
                <span className="font-sans font-medium text-sm text-foreground capitalize">
                  {scenario.target.kind}
                </span>
                {targetString && (
                  <>
                    <span className="font-mono text-xs text-foreground break-all">
                      {targetString}
                    </span>
                    <CopyButton value={targetString} ariaLabel="Copy target" />
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center py-3 text-left">
              <span className="font-sans text-label-caps uppercase text-muted-foreground font-semibold">
                Amount
              </span>
              {amountSats !== null ? (
                <span className="font-display font-medium text-base text-foreground tabular-nums">
                  <AnimatedNumber value={amountSats} /> sats
                </span>
              ) : (
                <span className="font-sans text-sm text-muted-foreground">
                  Not specified
                </span>
              )}
            </div>

            <div className="flex justify-between items-center py-3 text-left">
              <span className="font-sans text-label-caps uppercase text-muted-foreground font-semibold">
                Status
              </span>
              <StatusBadge status={scenario.status} />
            </div>

            <div className="flex justify-between items-center py-3 text-left">
              <span className="font-sans text-label-caps uppercase text-muted-foreground font-semibold">
                Network
              </span>
              <span className="font-sans text-sm text-foreground">
                {networkLabel(scenario.network || "testnet")}
              </span>
            </div>
          </Card>

          <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none">
            <EmptyState
              icon={DotShield}
              title="Privacy analysis coming soon"
              description="The taint graph and evidence bundle for this payment will appear here."
              className="border-none bg-transparent p-0 my-0 max-w-full"
            />
          </Card>

          <div className="pt-2">
            <Button
              variant="ghost"
              size="md"
              onClick={() => navigate("/app/history")}
              className="w-fit"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              <span>Back to history</span>
            </Button>
          </div>
        </>
      ) : null}
    </motion.div>
  );
};
