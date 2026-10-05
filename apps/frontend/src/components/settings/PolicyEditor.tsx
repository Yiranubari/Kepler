import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import {
  updatePolicy,
  type PolicyResponse,
  type UpdatePolicyRequest,
  ClientError
} from "@/lib/api";

export interface PolicyEditorProps {
  policy: PolicyResponse;
  onSaved: () => void;
}

const SCOPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "Read", label: "Read" },
  { value: "Propose", label: "Propose" },
  { value: "Send", label: "Send" },
  { value: "Publish", label: "Publish" }
];

const TEXTAREA_CLASS =
  "flex min-h-[96px] w-full rounded-md border border-border/60 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 transition-[border-color,box-shadow] duration-150 hover:border-border focus-visible:outline-none focus-visible:border-foreground/50 focus-visible:ring-1 focus-visible:ring-foreground/20";

function toLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function isPositiveInteger(value: string): boolean {
  return /^[0-9]+$/.test(value) && Number(value) > 0;
}

function initialScopes(policy: PolicyResponse): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const option of SCOPE_OPTIONS) {
    next[option.value] = policy.scopes.includes(option.value);
  }
  return next;
}

export const PolicyEditor: React.FC<PolicyEditorProps> = ({
  policy,
  onSaved
}) => {
  const [dailyLimit, setDailyLimit] = useState<string>(policy.dailyBudgetSats);
  const [perTxLimit, setPerTxLimit] = useState<string>(policy.perTxBudgetSats);
  const [scopes, setScopes] = useState<Record<string, boolean>>(() =>
    initialScopes(policy)
  );
  const [allowedMints, setAllowedMints] = useState<string>(
    policy.allowedMints.join("\n")
  );
  const [allowedRelays, setAllowedRelays] = useState<string>(
    policy.allowedRelays.join("\n")
  );
  const [allowedEsplora, setAllowedEsplora] = useState<string>(
    policy.allowedEsplora.join("\n")
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation<PolicyResponse, ClientError, UpdatePolicyRequest>({
    mutationFn: (input: UpdatePolicyRequest) => updatePolicy(input)
  });

  const resetFields = (): void => {
    setDailyLimit(policy.dailyBudgetSats);
    setPerTxLimit(policy.perTxBudgetSats);
    setScopes(initialScopes(policy));
    setAllowedMints(policy.allowedMints.join("\n"));
    setAllowedRelays(policy.allowedRelays.join("\n"));
    setAllowedEsplora(policy.allowedEsplora.join("\n"));
    setValidationError(null);
  };

  const handleCancel = (): void => {
    resetFields();
    onSaved();
  };

  const toggleScope = (scope: string): void => {
    setScopes((current) => ({ ...current, [scope]: !current[scope] }));
  };

  const handleSubmit = (): void => {
    if (!isPositiveInteger(dailyLimit)) {
      setValidationError(
        "Enter a daily limit that is a whole number above zero."
      );
      return;
    }
    if (!isPositiveInteger(perTxLimit)) {
      setValidationError(
        "Enter a per transaction limit that is a whole number above zero."
      );
      return;
    }
    if (Number(perTxLimit) > Number(dailyLimit)) {
      setValidationError(
        "The per transaction limit cannot be higher than the daily limit."
      );
      return;
    }

    const selectedScopes = SCOPE_OPTIONS.filter(
      (option) => scopes[option.value]
    ).map((option) => option.value);

    if (selectedScopes.length === 0) {
      setValidationError("Turn on at least one scope.");
      return;
    }

    setValidationError(null);
    mutation.mutate(
      {
        dailyBudgetSats: dailyLimit,
        perTxBudgetSats: perTxLimit,
        scopes: selectedScopes,
        allowedMints: toLines(allowedMints),
        allowedRelays: toLines(allowedRelays),
        allowedEsplora: toLines(allowedEsplora)
      },
      {
        onSuccess: () => {
          toast.success("Saved.");
          onSaved();
        }
      }
    );
  };

  const errorMessage =
    validationError ??
    (mutation.error ? mutation.error.friendlyMessage : null);

  return (
    <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-6">
      <div className="divide-y divide-white/[0.06]">
        <div className="space-y-4 pb-6">
          <Input
            label="Daily limit (sats)"
            inputMode="numeric"
            value={dailyLimit}
            onChange={(event) => setDailyLimit(event.target.value)}
          />
          <Input
            label="Per transaction limit (sats)"
            inputMode="numeric"
            value={perTxLimit}
            onChange={(event) => setPerTxLimit(event.target.value)}
          />
          <p className="font-sans text-body-sm text-muted-foreground">
            Amounts are in satoshis.
          </p>
        </div>

        <div className="space-y-3 py-6">
          <Label>Scopes</Label>
          <div className="flex flex-wrap gap-4">
            {SCOPE_OPTIONS.map((option) => {
              const checkboxId = `scope-${option.value.toLowerCase()}`;
              return (
                <div key={option.value} className="flex items-center gap-2">
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={scopes[option.value]}
                    onChange={() => toggleScope(option.value)}
                    className="h-4 w-4 shrink-0 rounded border-border accent-accent"
                  />
                  <Label htmlFor={checkboxId}>{option.label}</Label>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 py-6">
          <Label htmlFor="allowed-mints">Allowed mints</Label>
          <textarea
            id="allowed-mints"
            value={allowedMints}
            onChange={(event) => setAllowedMints(event.target.value)}
            className={TEXTAREA_CLASS}
          />
          <p className="font-sans text-body-sm text-muted-foreground">
            One value per line.
          </p>
        </div>

        <div className="space-y-2 py-6">
          <Label htmlFor="allowed-relays">Allowed relays</Label>
          <textarea
            id="allowed-relays"
            value={allowedRelays}
            onChange={(event) => setAllowedRelays(event.target.value)}
            className={TEXTAREA_CLASS}
          />
          <p className="font-sans text-body-sm text-muted-foreground">
            One value per line.
          </p>
        </div>

        <div className="space-y-2 pt-6">
          <Label htmlFor="allowed-esplora">Allowed Esplora endpoints</Label>
          <textarea
            id="allowed-esplora"
            value={allowedEsplora}
            onChange={(event) => setAllowedEsplora(event.target.value)}
            className={TEXTAREA_CLASS}
          />
          <p className="font-sans text-body-sm text-muted-foreground">
            One value per line.
          </p>
        </div>
      </div>

      {errorMessage && (
        <p role="alert" className="font-sans text-body-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="md" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="md"
          className="rounded-full"
          onClick={handleSubmit}
          disabled={mutation.isPending}
        >
          Save changes
        </Button>
      </div>
    </Card>
  );
};
