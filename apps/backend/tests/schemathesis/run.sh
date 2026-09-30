#!/usr/bin/env bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ROOT_DIR="$(cd "${BACKEND_DIR}/../.." && pwd)"

cd "${BACKEND_DIR}"

NODE_OPTIONS="--no-network-family-autoselection" NWC_TIMEOUT_MS=5000 npx tsx -r dotenv/config src/index.ts dotenv_config_path="${ROOT_DIR}/.env.test" &
SERVER_PID=$!

cleanup() {
  if [ -n "${SERVER_PID}" ]; then
    kill -9 $(lsof -t -i :3000 2>/dev/null) 2>/dev/null || true
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

READY=0
for i in $(seq 1 30); do
  if curl -s "http://localhost:3000/api/graph/probe" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.5
done

if [ "${READY}" -ne 1 ]; then
  exit 1
fi

set +e
schemathesis run openapi.yaml \
  --url http://localhost:3000 \
  --include-path /api/proof/build \
  --include-path /api/proof/verify \
  --include-path "/api/proof/{bundleHash}" \
  --include-path "/api/proof/scenario/{scenarioId}" \
  --include-path /api/scenarios \
  --include-path "/api/scenarios/{id}" \
  --include-path "/api/scenarios/{id}/status" \
  --include-path /api/protocols/bitcoin/transaction \
  --include-path /api/protocols/bitcoin/address \
  --include-path /api/protocols/bitcoin/tip \
  --include-path /api/protocols/lightning/decode \
  --include-path /api/protocols/lightning/lookup \
  --include-path /api/protocols/lightning/transactions \
  --include-path /api/protocols/nostr/event \
  --include-path /api/protocols/nostr/author \
  --include-path /api/protocols/cashu/mint \
  --include-path /api/onchain/derive \
  --include-path /api/onchain/utxos \
  --include-path /api/onchain/fees \
  --include-path /api/onchain/psbt/build \
  --include-path /api/onchain/psbt/broadcast \
  --include-path /api/ai/explain \
  --include-path /api/ai/summarize \
  --include-path /api/ai/suggest \
  --request-timeout 60 \
  --checks status_code_conformance,content_type_conformance,response_schema_conformance \
  --suppress-health-check=filter_too_much \
  --report junit \
  --report-junit-path tests/schemathesis/report.xml \
  --no-color > tests/schemathesis/report.md 2>&1
TEST_EXIT_CODE=$?
set -e

exit "${TEST_EXIT_CODE}"
