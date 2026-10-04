import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Clock } from "lucide-react";
import {
  decodeLightningInvoice,
  getFees,
  getMintInfo,
  createScenario,
  orchestrate,
  getPolicy,
  type ScenarioResponse,
  type LightningDecodeResponse,
  type OnchainFeesResponse,
  type CashuMintInfoResponse,
  ClientError
} from "@/lib/api";
import { FALLBACK_ERROR_MESSAGE } from "@/lib/errorMessages";
import { PageHeader } from "@/components/layout/PageHeader";
import { StepTransition } from "@/components/motion/StepTransition";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { ShakeOnError } from "@/components/motion/ShakeOnError";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { CopyButton } from "@/components/ui/copy-button";
import { DotCheck } from "@/components/visual/icons/DotCheck";
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
  const [bitcoinAmount, setBitcoinAmount] = useState<string>("");
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

  const isPositiveInteger = (val: string): boolean => {
    return /^[1-9]\d*$/.test(val.trim());
  };

  const isBitcoinValid =
    detectedKind === "bitcoin" ? isPositiveInteger(bitcoinAmount) : true;

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

  const handleDestinationChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDestination(e.target.value);
    if (inputError) {
      setInputError("");
    }
  };

  const loadPreview = async () => {
    if (!detectedKind) {
      setInputError("Please enter a valid Lightning invoice, Bitcoin address, or ecash request.");
      return;
    }

    if (detectedKind === "bitcoin" && !isBitcoinValid) {
      setInputError("Please enter a valid amount in satoshis.");
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
        const decoded = await decodeLightningInvoice(cleanDestination);
        setLightningDetails(decoded);
      } else if (detectedKind === "bitcoin") {
        targetPayload = {
          address: cleanDestination,
          amountSats: bitcoinAmount.trim()
        };
        const fees = await getFees();
        setBitcoinFees(fees);
      } else if (detectedKind === "cashu") {
        targetPayload = { request: cleanDestination };
        let mintUrl = cleanDestination;
        if (!mintUrl.startsWith("http:") && !mintUrl.startsWith("https:")) {
          const policy = await getPolicy();
          mintUrl = policy.allowedMints[0] || "";
        }
        if (mintUrl) {
          const mintInfo = await getMintInfo(mintUrl);
          setCashuMintDetails(mintInfo);
        }
      }

      const created = await createScenario({
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
      await orchestrate(scenario.id);
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

  const stepsMeta: { key: StepType; label: string }[] = [
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

  const getDetectionLabel = (): string => {
    if (detectedKind === "lightning") return "Detected: Lightning invoice";
    if (detectedKind === "bitcoin") return "Detected: Bitcoin address";
    if (detectedKind === "cashu") return "Detected: ecash request";
    return "";
  };

  const getPreviewTitle = (): string => {
    if (detectedKind === "lightning") return "Lightning payment";
    if (detectedKind === "bitcoin") return "On-chain payment";
    if (detectedKind === "cashu") return "Ecash payment";
    return "Payment preview";
  };

  const getExecuteErrorMessage = (): string => {
    if (executeError instanceof ClientError) {
      return executeError.friendlyMessage;
    }
    return FALLBACK_ERROR_MESSAGE;
  };

  const feeTiers = bitcoinFees
    ? [
        { id: "hour", label: "Economy", rate: bitcoinFees.economy || bitcoinFees.hour },
        { id: "halfHour", label: "Normal", rate: bitcoinFees.halfHour },
        { id: "fastest", label: "Priority", rate: bitcoinFees.fastest }
      ]
    : [];

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.15, ease: "easeOut" } }}
      className="w-full space-y-16 md:space-y-24"
    >
      <PageHeader
        title="Send a payment"
        subtitle="Paste a Lightning invoice, Bitcoin address, or ecash request to get started."
      />

      <div className="w-full max-w-2xl space-y-8">
        <nav aria-label="Progress" className="flex items-center gap-6 py-2">
          {stepsMeta.map((s) => {
            const isActive = step === s.key;
            return (
              <div key={s.key} className="flex items-center gap-2">
                {isActive ? (
                  <motion.div
                    layoutId="sendStepDot"
                    className="w-2 h-2 rounded-full bg-accent"
                    transition={{ duration: 0.2 }}
                  />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-transparent" />
                )}
                <span
                  className={cn(
                    "font-sans text-xs transition-colors duration-200 select-none",
                    isActive ? "text-foreground font-medium" : "text-muted-foreground"
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
              <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-4">
                <div className="flex flex-col gap-2">
                  <Label
                    htmlFor="destination-input"
                    className="font-sans text-xs text-muted-foreground font-semibold"
                  >
                    Destination
                  </Label>
                  <ShakeOnError errorKey={inputError}>
                    <textarea
                      id="destination-input"
                      rows={5}
                      value={destination}
                      onChange={handleDestinationChange}
                      placeholder="Paste bolt11 invoice, Bitcoin address, or Cashu token"
                      autoFocus
                      aria-invalid={Boolean(inputError)}
                      aria-describedby={inputError ? "destination-error" : undefined}
                      className={cn(
                        "w-full rounded-md border bg-transparent p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 transition-[border-color,box-shadow] duration-150 focus-visible:outline-none resize-none min-h-[140px]",
                        inputError
                          ? "border-destructive focus-visible:ring-1 focus-visible:ring-destructive"
                          : "border-white/[0.08] hover:border-white/20 focus-visible:border-foreground/50 focus-visible:ring-1 focus-visible:ring-foreground/20"
                      )}
                    />
                  </ShakeOnError>

                  {getDetectionLabel() && (
                    <p className="font-sans text-body-sm text-muted-foreground mt-1">
                      {getDetectionLabel()}
                    </p>
                  )}

                  {inputError && (
                    <p
                      id="destination-error"
                      role="alert"
                      className="font-sans text-body-sm text-destructive mt-1"
                    >
                      {inputError}
                    </p>
                  )}
                </div>

                {detectedKind === "bitcoin" && (
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-white/[0.06]">
                    <Label
                      htmlFor="bitcoin-amount-input"
                      className="font-sans text-xs text-muted-foreground font-semibold"
                    >
                      Amount in sats
                    </Label>
                    <input
                      id="bitcoin-amount-input"
                      type="number"
                      min="1"
                      value={bitcoinAmount}
                      onChange={(e) => setBitcoinAmount(e.target.value)}
                      className="h-11 w-full rounded-md border border-white/[0.08] bg-transparent px-3 py-2 font-mono text-sm text-foreground transition-colors hover:border-white/20 focus-visible:outline-none focus-visible:border-foreground/50 focus-visible:ring-1 focus-visible:ring-foreground/20"
                    />
                    {!isPositiveInteger(bitcoinAmount) && (
                      <p className="font-sans text-body-sm text-muted-foreground mt-0.5">
                        Enter an amount in sats to continue.
                      </p>
                    )}
                  </div>
                )}
              </Card>

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="md"
                  className="rounded-full"
                  onClick={loadPreview}
                  disabled={!detectedKind || !isBitcoinValid}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-6">
              {isPreviewLoading && (
                <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none min-h-[340px] flex flex-col items-center justify-center text-center space-y-4">
                  <Spinner size="lg" />
                  <p className="font-sans text-body text-muted-foreground">
                    Checking your payment...
                  </p>
                </Card>
              )}

              {Boolean(previewError) && (
                <Card className="rounded-[12px] border border-destructive/40 bg-card p-5 md:p-8 shadow-none min-h-[340px] flex flex-col justify-between space-y-6">
                  <div className="flex items-start gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                    <p className="font-sans text-body text-foreground text-left">
                      {previewError instanceof ClientError
                        ? previewError.friendlyMessage
                        : FALLBACK_ERROR_MESSAGE}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="md" onClick={handleBackToInput}>
                      <ArrowLeft className="w-4 h-4 mr-1.5" />
                      <span>Back</span>
                    </Button>
                    <Button variant="primary" size="md" className="rounded-full" onClick={loadPreview}>
                      Try again
                    </Button>
                  </div>
                </Card>
              )}

              {!isPreviewLoading && !previewError && (
                <motion.div
                  variants={fadeInUp}
                  initial={shouldReduceMotion ? { opacity: 0 } : "initial"}
                  animate={shouldReduceMotion ? { opacity: 1 } : "animate"}
                >
                  <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-6">
                    <div className="pb-4 border-b border-white/[0.06]">
                      <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground">
                        {getPreviewTitle()}
                      </h2>
                    </div>

                    <div className="space-y-4">
                      {detectedKind === "lightning" && lightningDetails && (
                        <div className="space-y-4 divide-y divide-white/[0.06]">
                          <div className="flex justify-between items-center py-2 first:pt-0">
                            <span className="font-sans text-body text-muted-foreground">Amount</span>
                            <span className="font-display font-medium text-lg text-foreground tabular-nums">
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
                              <span className="font-sans text-body text-muted-foreground">Description</span>
                              <span className="font-sans text-body text-foreground text-right max-w-xs break-words">
                                {lightningDetails.description}
                              </span>
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 gap-1 sm:gap-2">
                            <span className="font-sans text-body text-muted-foreground shrink-0">Payment hash</span>
                            <div className="flex items-center gap-2 max-w-full">
                              <span className="font-mono text-xs text-foreground truncate max-w-[200px] sm:max-w-xs">
                                {lightningDetails.paymentHash}
                              </span>
                              <CopyButton
                                value={lightningDetails.paymentHash}
                                ariaLabel="Copy payment hash"
                              />
                            </div>
                          </div>

                          <div className="flex justify-between items-center py-2">
                            <span className="font-sans text-body text-muted-foreground">Expires in</span>
                            <div className="flex items-center gap-1.5 font-mono text-sm font-medium">
                              <Clock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                              <span
                                className={cn(
                                  remainingExpirySec < 60
                                    ? "text-destructive"
                                    : "text-foreground"
                                )}
                              >
                                {formatCountdown(remainingExpirySec)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {detectedKind === "bitcoin" && bitcoinFees && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center py-2 border-b border-white/[0.06]">
                            <span className="font-sans text-body text-muted-foreground">Amount</span>
                            <span className="font-display font-medium text-lg text-foreground tabular-nums">
                              <AnimatedNumber value={Number(bitcoinAmount) || 0} /> sats
                            </span>
                          </div>
                          <div className="space-y-2">
                            <span className="font-sans text-label-caps uppercase text-muted-foreground font-semibold">
                              Network fee
                            </span>
                            <div className="grid grid-cols-3 gap-2 p-1 rounded-[12px] bg-white/[0.02] border border-white/[0.08]">
                              {feeTiers.map((tier) => (
                                <Button
                                  key={tier.id}
                                  type="button"
                                  variant="ghost"
                                  onClick={() => setSelectedFeeTier(tier.id)}
                                  className={cn(
                                    "flex flex-col items-center justify-center h-auto py-3 px-2 rounded-[8px] transition-colors border",
                                    selectedFeeTier === tier.id
                                      ? "bg-white/[0.1] text-foreground border-white/[0.16] shadow-none"
                                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                                  )}
                                >
                                  <span className="font-sans text-xs font-medium">{tier.label}</span>
                                  <span className="font-display font-medium text-sm text-foreground tabular-nums mt-1">
                                    <AnimatedNumber value={tier.rate} /> sat/vB
                                  </span>
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {detectedKind === "cashu" && cashuMintDetails && (
                        <div className="space-y-4 divide-y divide-white/[0.06]">
                          <div className="flex justify-between items-center py-2 first:pt-0">
                            <span className="font-sans text-body text-muted-foreground">Mint name</span>
                            <span className="font-display font-semibold text-foreground">
                              {cashuMintDetails.name}
                            </span>
                          </div>
                          {cashuMintDetails.description && (
                            <div className="flex justify-between items-start py-2 gap-4">
                              <span className="font-sans text-body text-muted-foreground">Description</span>
                              <span className="font-sans text-body text-foreground text-right max-w-xs break-words">
                                {cashuMintDetails.description}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center py-2">
                            <span className="font-sans text-body text-muted-foreground">Version</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {cashuMintDetails.version}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between gap-4">
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={handleBackToInput}
                      >
                        <ArrowLeft className="w-4 h-4 mr-1.5" />
                        <span>Back</span>
                      </Button>
                      <Button
                        variant="primary"
                        size="md"
                        className="rounded-full"
                        onClick={handleExecutePayment}
                      >
                        Send payment
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )}
            </div>
          )}

          {step === "execute" && (
            <div className="space-y-6">
              {isExecuting && (
                <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none min-h-[340px] flex flex-col items-center justify-center text-center space-y-4">
                  <Spinner size="lg" />
                  <p className="font-sans text-body text-muted-foreground">
                    Sending your payment...
                  </p>
                </Card>
              )}

              {Boolean(executeError) && (
                <ShakeOnError errorKey={executeError}>
                  <Card className="rounded-[12px] border border-destructive/40 bg-card p-5 md:p-8 shadow-none min-h-[340px] flex flex-col justify-between space-y-6">
                    <div className="flex items-start gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                      <p className="font-sans text-body text-foreground text-left">
                        {getExecuteErrorMessage()}
                      </p>
                    </div>
                    <div className="flex justify-start">
                      <Button
                        variant="primary"
                        size="md"
                        className="rounded-full"
                        onClick={handleRetryFromExecute}
                      >
                        Try again
                      </Button>
                    </div>
                  </Card>
                </ShakeOnError>
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
                  <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none min-h-[340px] flex flex-col items-center justify-center text-center space-y-6">
                    <div className="p-4 rounded-full bg-secondary/40 text-foreground">
                      <DotCheck size={64} className="text-foreground" />
                    </div>

                    <div className="space-y-1 text-center">
                      <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground">
                        Payment sent.
                      </h2>
                    </div>

                    <div className="w-full max-w-md p-3 rounded-md border border-white/[0.08] bg-white/[0.03] flex items-center justify-between gap-3 text-left">
                      <span className="font-mono text-xs text-foreground truncate">
                        {executedScenarioId}
                      </span>
                      <CopyButton
                        value={executedScenarioId}
                        ariaLabel="Copy payment identifier"
                      />
                    </div>

                    <Button
                      variant="primary"
                      size="md"
                      className="rounded-full w-full sm:w-auto"
                      onClick={() => navigate(`/app/history/${executedScenarioId}`)}
                    >
                      View receipt
                    </Button>
                  </Card>
                </motion.div>
              )}
            </div>
          )}
        </StepTransition>
      </div>
    </motion.div>
  );
};
