import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import {
  api,
  getPolicy,
  type ScenarioResponse,
  type LightningDecodeResponse,
  type OnchainFeesResponse,
  type CashuMintInfoResponse
} from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState } from "@/components/layout/LoadingState";
import { ErrorState } from "@/components/layout/ErrorState";
import { StepTransition } from "@/components/motion/StepTransition";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter
} from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { fadeInUp, useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type StepType = "input" | "preview" | "execute";
type DirectionType = "forward" | "backward";
type DestinationKind = "lightning" | "bitcoin" | "cashu";

function detectDestinationKind(raw: string): DestinationKind | null {
  const value = raw.trim();
  if (!value) return null;

  const lower = value.toLowerCase();

  if (
    lower.startsWith("lnbc") ||
    lower.startsWith("lntb") ||
    lower.startsWith("lnbcrt") ||
    lower.startsWith("lnsb") ||
    lower.startsWith("lightning:ln")
  ) {
    return "lightning";
  }

  if (
    lower.startsWith("cashua") ||
    lower.startsWith("cashub") ||
    lower.startsWith("cashu://") ||
    lower.startsWith("cashu:")
  ) {
    return "cashu";
  }

  if (lower.startsWith("http:") || lower.startsWith("https:")) {
    if (lower.includes("mint") || lower.includes("cashu")) {
      return "cashu";
    }
  }

  if (
    lower.startsWith("bc1") ||
    lower.startsWith("tb1") ||
    lower.startsWith("bcrt1") ||
    lower.startsWith("bitcoin:") ||
    /^(1|3|m|n|2)[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(value)
  ) {
    return "bitcoin";
  }

  return null;
}

export const SendPage: React.FC = () => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const [step, setStep] = useState<StepType>("input");
  const [direction, setDirection] = useState<DirectionType>("forward");

  const [destination, setDestination] = useState<string>("");
  const [bitcoinAmount, setBitcoinAmount] = useState<string>("10000");
  const [inputError, setInputError] = useState<string>("");

  const [scenario, setScenario] = useState<ScenarioResponse | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<unknown>(null);

  const [lightningDetails, setLightningDetails] =
    useState<LightningDecodeResponse | null>(null);
  const [remainingExpirySec, setRemainingExpirySec] = useState<number>(0);

  const [bitcoinFees, setBitcoinFees] = useState<OnchainFeesResponse | null>(null);
  const [selectedFeeTier, setSelectedFeeTier] = useState<string>("halfHour");

  const [cashuMintDetails, setCashuMintDetails] =
    useState<CashuMintInfoResponse | null>(null);

  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executeError, setExecuteError] = useState<unknown>(null);
  const [executedScenarioId, setExecutedScenarioId] = useState<string>("");

  const detectedKind = detectDestinationKind(destination);

  useEffect(() => {
    if (!lightningDetails) return;

    const calculateRemaining = () => {
      const expiresAtMs =
        (lightningDetails.timestamp + lightningDetails.expiry) * 1000;
      const diffSec = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      setRemainingExpirySec(diffSec);
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [lightningDetails]);

  const handleDestinationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDestination(e.target.value);
    if (inputError) {
      setInputError("");
    }
  };

  const loadPreview = async () => {
    if (!detectedKind) {
      setInputError("Please enter a valid Lightning invoice, Bitcoin address, or Cashu token.");
      return;
    }

    setIsPreviewLoading(true);
    setPreviewError(null);
    setDirection("forward");
    setStep("preview");

    try {
      const cleanDestination = destination.trim();
      let targetPayload: Record<string, unknown> = {};

      if (detectedKind === "lightning") {
        targetPayload = { invoice: cleanDestination };
        const decoded = await api.decodeLightningInvoice(cleanDestination);
        setLightningDetails(decoded);
      } else if (detectedKind === "bitcoin") {
        targetPayload = {
          address: cleanDestination,
          amountSats: bitcoinAmount.trim() || "10000"
        };
        const fees = await api.getFees();
        setBitcoinFees(fees);
      } else if (detectedKind === "cashu") {
        targetPayload = { request: cleanDestination };
        let mintUrl = cleanDestination;
        if (!mintUrl.startsWith("http:") && !mintUrl.startsWith("https:")) {
          const policy = await getPolicy();
          mintUrl = policy.allowedMints[0] || "";
        }
        if (mintUrl) {
          const mintInfo = await api.getMintInfo(mintUrl);
          setCashuMintDetails(mintInfo);
        }
      }

      const created = await api.createScenario({
        kind: detectedKind,
        payload: targetPayload
      });
      setScenario(created);
    } catch (err: unknown) {
      setPreviewError(err);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleExecutePayment = async () => {
    if (!scenario) return;

    setIsExecuting(true);
    setExecuteError(null);
    setDirection("forward");
    setStep("execute");

    try {
      await api.orchestrate(scenario.id);
      setExecutedScenarioId(scenario.id);
    } catch (err: unknown) {
      setExecuteError(err);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleBackToInput = () => {
    setDirection("backward");
    setStep("input");
  };

  const handleRetryFromExecute = () => {
    setDirection("backward");
    setStep("preview");
    setExecuteError(null);
  };

  const handleResetFlow = () => {
    setDestination("");
    setBitcoinAmount("10000");
    setScenario(null);
    setLightningDetails(null);
    setBitcoinFees(null);
    setCashuMintDetails(null);
    setExecuteError(null);
    setExecutedScenarioId("");
    setDirection("backward");
    setStep("input");
  };

  const stepOrder: StepType[] = ["input", "preview", "execute"];
  const currentStepIndex = stepOrder.indexOf(step);

  const stepsMeta = [
    { key: "input", label: "Input" },
    { key: "preview", label: "Preview" },
    { key: "execute", label: "Send" }
  ];

  const formatCountdown = (sec: number): string => {
    if (sec <= 0) return "Expired";
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return (
    <div className="w-full space-y-8 max-w-xl mx-auto">
      <PageHeader
        title="Send payment"
        subtitle="Paste an invoice, address, or token to send funds."
      />

      <nav aria-label="Progress" className="flex items-center justify-center gap-6 py-2">
        {stepsMeta.map((s, index) => {
          const isActive = step === s.key;
          const isCompleted = currentStepIndex > index;

          return (
            <div key={s.key} className="flex flex-col items-center gap-2">
              <motion.div
                animate={{
                  scale: isActive ? 1.2 : 1,
                  backgroundColor: isActive
                    ? "hsl(var(--accent))"
                    : isCompleted
                    ? "hsl(var(--foreground))"
                    : "hsl(var(--secondary))"
                }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "w-3 h-3 rounded-full border border-border/60 transition-colors",
                  isActive && "border-accent ring-2 ring-accent/30"
                )}
              />
              <span
                className={cn(
                  "text-xs transition-colors duration-150 select-none",
                  isActive
                    ? "text-foreground font-semibold"
                    : isCompleted
                    ? "text-muted-foreground"
                    : "text-muted-foreground/60"
                )}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </nav>

      <StepTransition stepKey={step} direction={direction}>
        {step === "input" && (
          <div className="space-y-6">
            <Card className="p-6">
              <CardContent className="p-0 space-y-4">
                <Input
                  label="Destination"
                  placeholder="Paste bolt11 invoice, Bitcoin address, or Cashu token"
                  value={destination}
                  onChange={handleDestinationChange}
                  error={inputError}
                  autoFocus
                />

                {detectedKind && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Detected:</span>
                    <span className="capitalize text-accent font-semibold">
                      {detectedKind} payment
                    </span>
                  </div>
                )}

                {detectedKind === "bitcoin" && (
                  <Input
                    label="Amount in sats"
                    type="number"
                    min="1"
                    value={bitcoinAmount}
                    onChange={(e) => setBitcoinAmount(e.target.value)}
                  />
                )}
              </CardContent>
              <CardFooter className="p-0 pt-6 flex justify-end">
                <Button
                  variant="primary"
                  size="md"
                  onClick={loadPreview}
                  disabled={!detectedKind}
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-6">
            {isPreviewLoading && (
              <LoadingState statusText="Checking this payment..." cardsCount={2} />
            )}

            {Boolean(previewError) && (
              <div className="space-y-4">
                <ErrorState error={previewError} onRetry={loadPreview} />
                <div className="flex justify-start">
                  <Button variant="ghost" size="md" onClick={handleBackToInput}>
                    <ArrowLeft className="w-4 h-4 mr-1.5" />
                    <span>Back</span>
                  </Button>
                </div>
              </div>
            )}

            {!isPreviewLoading && !previewError && (
              <motion.div
                variants={fadeInUp}
                initial={shouldReduceMotion ? { opacity: 0 } : "initial"}
                animate={shouldReduceMotion ? { opacity: 1 } : "animate"}
              >
                <Card className="p-6 space-y-6">
                  <CardHeader className="p-0">
                    <CardTitle className="text-xl">Payment preview</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 space-y-4">
                    {detectedKind === "lightning" && lightningDetails && (
                      <div className="space-y-4 divide-y divide-border/40">
                        <div className="flex justify-between items-center py-2">
                          <span className="text-sm text-muted-foreground">Amount</span>
                          <span className="text-lg font-bold font-mono text-foreground">
                            <AnimatedNumber
                              value={Math.floor(
                                Number(lightningDetails.amountMsat) / 1000
                              )}
                            />{" "}
                            sats
                          </span>
                        </div>
                        {lightningDetails.description && (
                          <div className="flex justify-between items-start py-2 gap-4">
                            <span className="text-sm text-muted-foreground">Description</span>
                            <span className="text-sm text-foreground text-right max-w-xs break-words">
                              {lightningDetails.description}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center py-2">
                          <span className="text-sm text-muted-foreground">Expires in</span>
                          <span
                            className={cn(
                              "text-sm font-mono font-medium",
                              remainingExpirySec < 60
                                ? "text-destructive"
                                : "text-foreground"
                            )}
                          >
                            {formatCountdown(remainingExpirySec)}
                          </span>
                        </div>
                      </div>
                    )}

                    {detectedKind === "bitcoin" && bitcoinFees && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-border/40">
                          <span className="text-sm text-muted-foreground">Amount</span>
                          <span className="text-lg font-bold font-mono text-foreground">
                            <AnimatedNumber value={Number(bitcoinAmount) || 0} /> sats
                          </span>
                        </div>
                        <div className="space-y-2">
                          <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                            Recommended network fee
                          </span>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: "fastest", label: "Fastest", rate: bitcoinFees.fastest },
                              { id: "halfHour", label: "Standard", rate: bitcoinFees.halfHour },
                              { id: "hour", label: "Economy", rate: bitcoinFees.hour }
                            ].map((tier) => (
                              <button
                                key={tier.id}
                                type="button"
                                onClick={() => setSelectedFeeTier(tier.id)}
                                className={cn(
                                  "flex flex-col items-center justify-center p-3 rounded-md border text-center transition-colors select-none",
                                  selectedFeeTier === tier.id
                                    ? "border-accent bg-accent/10 text-foreground"
                                    : "border-border/60 bg-secondary/30 hover:border-border text-muted-foreground"
                                )}
                              >
                                <span className="text-xs font-medium">{tier.label}</span>
                                <span className="text-sm font-mono font-semibold text-foreground mt-1">
                                  <AnimatedNumber value={tier.rate} /> sat/vB
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {detectedKind === "cashu" && cashuMintDetails && (
                      <div className="space-y-4 divide-y divide-border/40">
                        <div className="flex justify-between items-center py-2">
                          <span className="text-sm text-muted-foreground">Mint name</span>
                          <span className="text-base font-semibold text-foreground">
                            {cashuMintDetails.name}
                          </span>
                        </div>
                        {cashuMintDetails.description && (
                          <div className="flex justify-between items-start py-2 gap-4">
                            <span className="text-sm text-muted-foreground">Description</span>
                            <span className="text-sm text-foreground text-right max-w-xs break-words">
                              {cashuMintDetails.description}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center py-2">
                          <span className="text-sm text-muted-foreground">Version</span>
                          <span className="text-sm font-mono text-muted-foreground">
                            {cashuMintDetails.version}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="p-0 pt-4 flex items-center justify-between gap-4">
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={handleBackToInput}
                    >
                      <ArrowLeft className="w-4 h-4 mr-1.5" />
                      <span>Back</span>
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleExecutePayment}
                    >
                      <span>Send payment</span>
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            )}
          </div>
        )}

        {step === "execute" && (
          <div className="space-y-6">
            {isExecuting && (
              <LoadingState statusText="Sending your payment..." cardsCount={2} />
            )}

            {Boolean(executeError) && (
              <div className="space-y-4">
                <ErrorState
                  error={executeError}
                  onRetry={handleRetryFromExecute}
                />
              </div>
            )}

            {!isExecuting && !Boolean(executeError) && executedScenarioId && (
              <motion.div
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 8 }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.3, ease: "easeOut" }
                }}
              >
                <Card className="p-8 text-center flex flex-col items-center justify-center space-y-6">
                  <div className="w-12 h-12 rounded-full bg-accent/15 text-accent flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                      Payment sent.
                    </h2>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Your payment has been orchestrated and executed.
                    </p>
                  </div>

                  <div className="w-full max-w-md p-4 rounded-md border border-border/60 bg-secondary/30 flex items-center justify-between gap-2">
                    <div className="flex flex-col items-start gap-0.5 overflow-hidden">
                      <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                        Payment identifier
                      </span>
                      <span className="text-xs font-mono text-foreground truncate w-full">
                        {executedScenarioId}
                      </span>
                    </div>
                    <CopyButton
                      value={executedScenarioId}
                      ariaLabel="Copy payment identifier"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs pt-2">
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full"
                      onClick={() => navigate(`/history/${executedScenarioId}`)}
                    >
                      View in history
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      className="w-full"
                      onClick={handleResetFlow}
                    >
                      Send another
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        )}
      </StepTransition>
    </div>
  );
};
