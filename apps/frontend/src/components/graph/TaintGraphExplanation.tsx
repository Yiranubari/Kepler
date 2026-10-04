import React from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReducedMotion } from "@/lib/motion";
import {
  explainTaintGraph,
  type AIExplainResponse,
  ClientError
} from "@/lib/api";

export interface TaintGraphExplanationProps {
  scenarioId: string;
}

function resolveErrorMessage(err: ClientError | null): string {
  if (!err) {
    return "The explanation service is offline right now. Your payment was not affected.";
  }
  if (
    err.code === "AI_NO_PROVIDER" ||
    err.code === "SERVICE_UNAVAILABLE" ||
    err.status === 503
  ) {
    return "The explanation service is offline right now. Your payment was not affected.";
  }
  return err.friendlyMessage;
}

export const TaintGraphExplanation: React.FC<TaintGraphExplanationProps> = ({
  scenarioId
}) => {
  const shouldReduceMotion = useReducedMotion();
  const {
    mutate: explain,
    data,
    isPending,
    error,
    reset
  } = useMutation<AIExplainResponse, ClientError>({
    mutationFn: () => explainTaintGraph(scenarioId)
  });

  return (
    <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-4">
      <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground">
        What this means
      </h2>

      {isPending ? (
        <div className="space-y-3 pt-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <p className="font-sans text-body-sm text-muted-foreground pt-1">
            Asking the explanation service...
          </p>
        </div>
      ) : error ? (
        <div className="space-y-4 pt-1">
          <p className="font-sans text-body text-muted-foreground">
            {resolveErrorMessage(error)}
          </p>
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                reset();
                explain();
              }}
              className="w-fit"
            >
              Try again
            </Button>
          </div>
        </div>
      ) : data ? (
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
          className="space-y-4 pt-1"
        >
          <p className="font-sans text-body text-foreground leading-relaxed whitespace-pre-line">
            {data.text}
          </p>
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => explain()}
              className="w-fit"
            >
              Refresh explanation
            </Button>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-4 pt-1">
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => explain()}
              className="w-fit"
            >
              Explain this graph
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
