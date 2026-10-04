import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DotCheck } from "@/components/visual/icons";
import { fadeInUp, useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  verifyEvidenceBundle,
  ClientError,
  type EvidenceBundleWire,
  type VerificationResultWire
} from "@/lib/api";
import { humanizeStepName } from "./EvidenceSteps";

export interface EvidenceVerifyProps {
  bundle: EvidenceBundleWire;
}

function tamperBundle(bundle: EvidenceBundleWire): EvidenceBundleWire {
  return {
    ...bundle,
    claim: {
      ...bundle.claim,
      text: `tampered ${bundle.claim.text}`
    }
  };
}

function reasonMessage(result: VerificationResultWire): string {
  if (result.reason === "HASH_MISMATCH") {
    return "The bundle does not match its own fingerprint. Something was changed.";
  }
  if (result.reason === "STEP_FAILED") {
    if (result.failedStep) {
      return `One of the checks did not pass. Failed check: ${humanizeStepName(
        result.failedStep
      )}.`;
    }
    return "One of the checks did not pass.";
  }
  if (result.reason === "MISSING_RAW_DATA") {
    return "The bundle is missing the data needed to verify it.";
  }
  return "Verification could not be completed.";
}

export const EvidenceVerify: React.FC<EvidenceVerifyProps> = ({ bundle }) => {
  const shouldReduceMotion = useReducedMotion();
  const [tampered, setTampered] = useState<boolean>(false);
  const [lastRunTampered, setLastRunTampered] = useState<boolean>(false);

  const {
    mutate,
    data,
    isPending,
    error,
    reset
  } = useMutation<VerificationResultWire, ClientError, EvidenceBundleWire>({
    mutationFn: (input: EvidenceBundleWire) => verifyEvidenceBundle(input)
  });

  const result = data ?? null;

  const runVerification = (): void => {
    setLastRunTampered(tampered);
    mutate(tampered ? tamperBundle(bundle) : bundle);
  };

  const runVerificationAgain = (): void => {
    reset();
    runVerification();
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-4">
        <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground">
          Verify this claim
        </h2>
        <p className="font-sans text-body text-muted-foreground">
          Confirm that the evidence behind this claim has not been altered.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button
            variant="primary"
            size="md"
            onClick={runVerification}
            disabled={isPending}
            className="w-fit"
          >
            {isPending ? (
              <>
                <Spinner size="sm" className="mr-2" />
                <span>Checking...</span>
              </>
            ) : (
              <span>Verify claim</span>
            )}
          </Button>

          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="font-sans text-body-sm text-muted-foreground">
                Simulate tampering
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={tampered}
                aria-label="Simulate tampering"
                onClick={() => setTampered((current) => !current)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border px-0.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  tampered ? "bg-accent border-accent" : "bg-muted border-border"
                )}
              >
                <motion.span
                  animate={{ x: tampered ? 24 : 0 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.15, ease: "easeOut" }
                  }
                  className="block h-4 w-4 rounded-full bg-foreground"
                />
              </button>
            </div>
            {tampered && (
              <span className="text-right font-sans text-body-sm text-muted-foreground">
                The next verify will test a modified version of this bundle.
              </span>
            )}
          </div>
        </div>
      </Card>

      {error ? (
        <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-4">
          <p className="font-sans text-body text-muted-foreground">
            {error.friendlyMessage}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={runVerification}
            className="w-fit"
          >
            Try again
          </Button>
        </Card>
      ) : result ? (
        result.valid ? (
          <motion.div
            variants={fadeInUp}
            initial={shouldReduceMotion ? { opacity: 0 } : "initial"}
            animate={shouldReduceMotion ? { opacity: 1 } : "animate"}
          >
            <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-3">
              <DotCheck size={32} aria-hidden="true" className="text-accent" />
              <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground">
                Claim verified
              </h2>
              <p className="font-sans text-body text-muted-foreground">
                The evidence matches what the bundle claims. Nothing was altered.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={runVerificationAgain}
                className="w-fit"
              >
                Verify again
              </Button>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 0 }}
            animate={
              shouldReduceMotion
                ? { opacity: 1, transition: { duration: 0.2 } }
                : {
                    opacity: 1,
                    x: [0, -4, 4, -4, 4, 0],
                    transition: { duration: 0.2, ease: "easeInOut" }
                  }
            }
          >
            <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-3">
              <span
                aria-hidden="true"
                className="block h-3 w-3 rounded-full bg-destructive"
              />
              <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground">
                Verification failed
              </h2>
              <p className="font-sans text-body text-muted-foreground">
                {reasonMessage(result)}
              </p>
              {lastRunTampered && (
                <p className="font-sans text-body-sm text-muted-foreground">
                  The bundle ID of this test is unchanged. The modified copy was
                  only sent to verification.
                </p>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={runVerificationAgain}
                className="w-fit"
              >
                Verify again
              </Button>
            </Card>
          </motion.div>
        )
      ) : null}
    </div>
  );
};
