import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api, type ScenarioResponse } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState } from "@/components/layout/LoadingState";
import { ErrorState } from "@/components/layout/ErrorState";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";

export const PaymentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: scenario,
    isLoading,
    error,
    refetch
  } = useQuery<ScenarioResponse>({
    queryKey: ["scenario", id],
    queryFn: () => {
      if (!id) {
        throw new Error("Missing payment identifier");
      }
      return api.getScenario(id);
    },
    enabled: Boolean(id)
  });

  return (
    <div className="w-full space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/history")}
        className="w-fit mb-2"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        <span>Back to history</span>
      </Button>

      <PageHeader
        title="Payment detail"
        subtitle="Verification and execution details for this payment."
      />

      {isLoading && (
        <LoadingState statusText="Checking your payment..." cardsCount={2} />
      )}

      {error && (
        <ErrorState error={error} onRetry={() => void refetch()} />
      )}

      {!isLoading && !error && scenario && (
        <div className="space-y-4 max-w-2xl">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-medium">Status</CardTitle>
              <StatusBadge status={scenario.status} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Payment Code</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-foreground break-all">
                    {scenario.id}
                  </span>
                  <CopyButton value={scenario.id} ariaLabel="Copy payment code" />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Type</span>
                <div className="text-sm font-medium text-foreground capitalize">
                  {scenario.target.kind}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Created</span>
                <div className="text-sm text-foreground">
                  {new Date(scenario.createdAt).toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
