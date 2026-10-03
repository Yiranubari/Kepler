import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { api, type ScenarioResponse } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { LoadingState } from "@/components/layout/LoadingState";
import { ErrorState } from "@/components/layout/ErrorState";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();

  const {
    data: scenarios,
    isLoading,
    error,
    refetch
  } = useQuery<ScenarioResponse[]>({
    queryKey: ["scenarios", "all"],
    queryFn: () => api.listScenarios({ limit: 50 })
  });

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Payment history"
        subtitle="Review past payments, route decisions, and verifiable evidence."
      />

      {isLoading && (
        <LoadingState statusText="Checking your payment..." cardsCount={4} />
      )}

      {error && (
        <ErrorState error={error} onRetry={() => void refetch()} />
      )}

      {!isLoading && !error && (!scenarios || scenarios.length === 0) && (
        <EmptyState
          title="No payments yet"
          description="Nothing here yet. Make your first payment to see it."
          actionLabel="Send payment"
          onAction={() => navigate("/send")}
        />
      )}

      {!isLoading && !error && scenarios && scenarios.length > 0 && (
        <StaggerList className="space-y-3">
          {scenarios.map((scenario) => (
            <StaggerItem key={scenario.id}>
              <Card
                onClick={() => navigate(`/history/${scenario.id}`)}
                className="p-4 hover:border-foreground/30 transition-colors cursor-pointer"
              >
                <CardContent className="p-0 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-muted-foreground">
                      {scenario.id}
                    </div>
                    <div className="text-sm font-medium text-foreground capitalize">
                      {scenario.target.kind} payment
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={scenario.status} />
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  );
};
