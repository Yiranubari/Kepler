import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
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
import { LoadingState } from "@/components/layout/LoadingState";
import { ErrorState } from "@/components/layout/ErrorState";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
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
    <div className="w-full space-y-6">
      <PageHeader
        title="Payment history"
        subtitle="Review past payments, route decisions, and receipts."
      />

      {isLoading && (
        <LoadingState statusText="Loading your payments..." cardsCount={4} />
      )}

      {Boolean(error) && (
        <ErrorState error={error} onRetry={() => void refetch()} />
      )}

      {!isLoading && !Boolean(error) && (!scenarios || scenarios.length === 0) && (
        <EmptyState
          title="No payments yet"
          description="Nothing here yet. Make your first payment to see it."
          actionLabel="Send payment"
          onAction={() => navigate("/send")}
        />
      )}

      {!isLoading && !Boolean(error) && scenarios && scenarios.length > 0 && (
        <StaggerList delayChildren={0.04} className="space-y-3">
          {scenarios.map((scenario) => (
            <StaggerItem key={scenario.id}>
              <motion.div
                whileHover={
                  shouldReduceMotion
                    ? undefined
                    : { y: -2, transition: { duration: 0.15, ease: "easeOut" } }
                }
              >
                <Card
                  onClick={() => navigate(`/history/${scenario.id}`)}
                  className="p-4 hover:border-foreground/30 transition-colors cursor-pointer"
                >
                  <CardContent className="p-0 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground capitalize">
                          {scenario.target.kind}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(scenario.createdAt)}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">
                        {formatTruncatedTarget(scenario.target)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={scenario.status} />
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  );
};
