import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  listScenarios,
  getAppConfig,
  type AppConfigResponse,
  type ScenarioResponse,
  type PaymentTargetInput,
  ClientError
} from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { ErrorState } from "@/components/layout/ErrorState";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { DotClock } from "@/components/visual/icons/DotClock";
import { DotSend } from "@/components/visual/icons/DotSend";
import { DotCoin } from "@/components/visual/icons/DotCoin";
import { DotLock } from "@/components/visual/icons/DotLock";
import { DotArrow } from "@/components/visual/icons/DotArrow";
import { useReducedMotion } from "@/lib/motion";

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

const formatTruncatedTarget = (target: PaymentTargetInput): string => {
  const payload = target.payload;
  if (typeof payload.invoice === "string" && payload.invoice.length > 0) {
    const inv = payload.invoice;
    return inv.length > 20 ? `${inv.slice(0, 10)}...${inv.slice(-6)}` : inv;
  }
  if (typeof payload.address === "string" && payload.address.length > 0) {
    const addr = payload.address;
    return addr.length > 20 ? `${addr.slice(0, 10)}...${addr.slice(-6)}` : addr;
  }
  if (typeof payload.mint === "string" && payload.mint.length > 0) {
    const mint = payload.mint;
    return mint.length > 24 ? `${mint.slice(0, 14)}...${mint.slice(-6)}` : mint;
  }
  if (typeof payload.destination === "string" && payload.destination.length > 0) {
    const dest = payload.destination;
    return dest.length > 20 ? `${dest.slice(0, 10)}...${dest.slice(-6)}` : dest;
  }
  return target.kind;
};

const renderKindIcon = (kind: string) => {
  const k = kind.toLowerCase();
  if (k === "lightning") {
    return <DotSend size={20} className="text-muted-foreground shrink-0" />;
  }
  if (k === "bitcoin") {
    return <DotCoin size={20} className="text-muted-foreground shrink-0" />;
  }
  if (k === "cashu") {
    return <DotLock size={20} className="text-muted-foreground shrink-0" />;
  }
  return <DotArrow size={20} className="text-muted-foreground shrink-0" />;
};

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const configQuery = useQuery<AppConfigResponse, ClientError>({
    queryKey: ["appConfig"],
    queryFn: getAppConfig
  });

  const currentNetwork = configQuery.data?.network;

  const {
    data: scenarios,
    isLoading: isScenariosLoading,
    error: scenariosError,
    refetch: refetchScenarios
  } = useQuery<ScenarioResponse[], ClientError>({
    queryKey: ["scenarios", "history", currentNetwork],
    queryFn: () => listScenarios(50, 0, currentNetwork)
  });

  const isLoading = isScenariosLoading || configQuery.isLoading;
  const error = scenariosError ?? configQuery.error;
  const refetch = (): void => {
    void refetchScenarios();
    void configQuery.refetch();
  };

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.15, ease: "easeOut" } }}
      className="w-full space-y-16 md:space-y-24"
    >
      <PageHeader
        title="Payment history"
        subtitle="Every payment you have made through Kepler. Click any row to see details."
      />

      {isLoading && (
        <Card className="rounded-[12px] border border-white/[0.08] bg-card p-0 shadow-none overflow-hidden divide-y divide-white/[0.06]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="min-h-[64px] flex items-center justify-between p-4 md:px-6">
              <div className="flex items-center gap-3">
                <Skeleton className="w-5 h-5 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          ))}
        </Card>
      )}

      {Boolean(error) && (
        <ErrorState error={error} onRetry={() => void refetch()} />
      )}

      {!isLoading && !Boolean(error) && (!scenarios || scenarios.length === 0) && (
        <EmptyState
          icon={DotClock}
          title="No payments yet"
          description="Make your first payment to see it."
          actionLabel="Send a payment"
          onAction={() => navigate("/app/send")}
        />
      )}

      {!isLoading && !Boolean(error) && scenarios && scenarios.length > 0 && (
        <Card className="rounded-[12px] border border-white/[0.08] bg-card p-0 shadow-none overflow-hidden divide-y divide-white/[0.06]">
          <StaggerList delayChildren={0.04}>
            {scenarios.map((scenario) => (
              <StaggerItem key={scenario.id}>
                <Link
                  to={`/app/history/${scenario.id}`}
                  className="min-h-[64px] flex items-center justify-between p-4 md:px-6 transition-colors duration-150 hover:bg-white/[0.04] w-full select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {renderKindIcon(scenario.target.kind)}
                    <div className="space-y-0.5 min-w-0 text-left">
                      <span className="font-sans font-medium text-sm text-foreground capitalize block">
                        {scenario.target.kind}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground truncate block">
                        {formatTruncatedTarget(scenario.target)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={scenario.status} />
                    <span className="font-sans text-xs text-muted-foreground">
                      {formatRelativeTime(scenario.createdAt)}
                    </span>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerList>
        </Card>
      )}
    </motion.div>
  );
};
