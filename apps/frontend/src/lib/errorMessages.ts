export const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "That information does not look right. Please check and try again.",
  NOT_FOUND: "We could not find that. Please check and try again.",
  NETWORK_ERROR: "We could not reach the network. Check your connection and try again.",
  POLICY_BUDGET_VIOLATION: "This payment is above your limit. You can adjust the limit in Settings.",
  POLICY_SCOPE_VIOLATION: "This action is turned off in Settings.",
  POLICY_ALLOWLIST_VIOLATION: "That service is not on your allowed list. Update your allowlist in Settings to use it.",
  POLICY_NOT_FOUND: "Your settings could not be loaded. Reload the page to try again.",
  ORCHESTRATOR_NO_ROUTE: "We could not find a way to send this payment. Try a different amount or destination.",
  ORCHESTRATOR_STATE_ERROR: "This payment is already in progress or already finished. Check your history.",
  ORCHESTRATOR_EXECUTION_ERROR: "The payment did not go through. Your funds were not moved.",
  ORCHESTRATOR_NOT_FOUND: "We could not find this payment. Check your history.",
  AI_NO_PROVIDER: "The explanation service is offline right now. Your payment was not affected.",
  AI_PROVIDER_ERROR: "The explanation service had a problem. Your payment was not affected.",
  AI_TIMEOUT_ERROR: "The explanation service took too long. Try again in a moment.",
  RATE_LIMIT_EXCEEDED: "You are going a bit fast. Wait a moment and try again.",
  ONCHAIN_INSUFFICIENT_FUNDS: "You do not have enough to cover this payment plus the network fee.",
  ONCHAIN_DERIVATION_ERROR: "We could not read your wallet. Please reconnect and try again.",
  ONCHAIN_PSBT_BUILD_ERROR: "We could not prepare this payment. Please try again.",
  ONCHAIN_BROADCAST_ERROR: "The network rejected this payment. It was not sent.",
  ONCHAIN_UNSUPPORTED_NETWORK: "This network is not supported yet.",
  CASHU_MINT_ERROR: "The ecash service had a problem. Your payment was not affected.",
  CASHU_MELT_ERROR: "The ecash payment did not go through. Your funds were not moved.",
  LIGHTNING_INVOICE_ERROR: "This invoice is not valid. Please check it and try again.",
  LIGHTNING_PAYMENT_ERROR: "The payment did not go through. Your funds were not moved.",
  LIGHTNING_TIMEOUT_ERROR: "The Lightning network took too long to respond. Try again in a moment.",
  BITCOIN_NOT_FOUND: "That transaction does not exist on the network.",
  BITCOIN_NETWORK_ERROR: "We could not reach the Bitcoin network. Check your connection and try again.",
  NOSTR_CONNECTION_ERROR: "We could not reach the Nostr network. Your payment was not affected.",
  SCENARIO_NOT_FOUND: "We could not find this payment. Check your history.",
  SCENARIO_STATE_ERROR: "This payment has already been processed. Check your history."
};

export const FALLBACK_ERROR_MESSAGE = "Something went wrong. Try again. If it keeps happening, contact support.";

export function getFriendlyMessage(code: string | undefined): string {
  if (!code) {
    return FALLBACK_ERROR_MESSAGE;
  }
  return ERROR_MESSAGES[code] ?? FALLBACK_ERROR_MESSAGE;
}
