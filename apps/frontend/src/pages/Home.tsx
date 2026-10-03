import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Plus, History } from "lucide-react";
import { api, type ScenarioResponse } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { LoadingState } from "@/components/layout/LoadingState";
import { ErrorState } from "@/components/layout/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  const {
    data: scenarios,
    isLoading,
    error,
    refetch
  } = useQuery<ScenarioResponse[]>({
    queryKey: ["scenarios", "recent"],
    queryFn: () => api.listScenarios({ limit: 5 })
  });

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Agent Wallet"
        subtitle="Cross-protocol payments with privacy analysis and verifiable evidence."
        action={
          <Button variant="primary" size="md" onClick={() => navigate("/send")}>
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Send payment</span>
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-6 flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
              Quick Action
            </span>
            <h2 className="text-xl font-bold text-foreground">
              Send Payment
            </h2>
            <p className="text-sm text-muted-foreground">
              Pay a Lightning invoice, Bitcoin address, or Cashu mint.
            </p>
          </div>
          <div className="mt-6">
            <Button variant="secondary" size="md" onClick={() => navigate("/send")}>
              <span>Start payment</span>
              <ArrowUpRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </Card>

        <Card className="p-6 flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
              Activity
            </span>
            <h2 className="text-xl font-bold text-foreground">
              Payment History
            </h2>
            <p className="text-sm text-muted-foreground">
              Inspect payment decisions, privacy checks, and evidence bundles.
            </p>
          </div>
          <div className="mt-6">
            <Button variant="secondary" size="md" onClick={() => navigate("/history")}>
              <span>View history</span>
              <History className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Recent payments
          </h2>
          {scenarios && scenarios.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>
              See all
            </Button>
          )}
        </div>

        {isLoading && (
          <LoadingState statusText="Checking your payment..." cardsCount={2} />
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
                        {scenario.id.slice(0, 16)}...
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
    </div>
  );
};
