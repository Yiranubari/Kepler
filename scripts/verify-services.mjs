#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv() {
  const envPath = existsSync(resolve(process.cwd(), '.env'))
    ? resolve(process.cwd(), '.env')
    : resolve(process.cwd(), 'apps/backend/.env');

  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

function curlGet(url, headers = {}, timeoutSec = 8) {
  const headerArgs = Object.entries(headers)
    .map(([k, v]) => `-H "${k}: ${v}"`)
    .join(' ');
  try {
    const cmd = `curl -s -S --max-time ${timeoutSec} ${headerArgs} "${url}"`;
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const fallbackCmd = `curl -4 -s -S --max-time ${timeoutSec} ${headerArgs} "${url}"`;
    return execSync(fallbackCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  }
}

console.log('====================================================');
console.log('Kepler Environment & External Services Verification');
console.log('====================================================\n');

let allPassed = true;

function verifyPostgres() {
  process.stdout.write('1. PostgreSQL: ');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('❌ FAILED: DATABASE_URL not set');
    return false;
  }
  try {
    const output = execSync(`psql "${dbUrl}" -c "SELECT NOW() as current_time;" -t`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000,
    }).trim();
    console.log(`✅ CONNECTED (Server Time: ${output})`);
    return true;
  } catch (err) {
    console.log(`❌ FAILED: ${err.message.split('\n')[0]}`);
    return false;
  }
}

function verifyEsplora() {
  process.stdout.write('2. Bitcoin Esplora API: ');
  const endpoints = [
    process.env.ESPLORA_URL || 'https://blockstream.info/api',
    process.env.ESPLORA_FALLBACK_URL || 'https://mempool.space/api',
  ];

  let verified = false;
  for (const ep of endpoints) {
    try {
      const height = curlGet(`${ep}/blocks/tip/height`, {}, 8).trim();
      if (height && !isNaN(Number(height))) {
        console.log(`✅ OK (${ep}) - Tip Block Height: ${height}`);
        verified = true;
        break;
      }
    } catch (err) {}
  }
  if (!verified) {
    console.log('❌ FAILED to reach any Esplora endpoint');
  }
  return verified;
}

function verifyGroq() {
  process.stdout.write('3. Groq Cloud AI API: ');
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.log('❌ FAILED: GROQ_API_KEY not set');
    return false;
  }
  try {
    const raw = curlGet('https://api.groq.com/openai/v1/models', {
      Authorization: `Bearer ${key}`,
    }, 10);
    const data = JSON.parse(raw);
    const models = (data.data || []).map((m) => m.id).slice(0, 3).join(', ');
    console.log(`✅ OK - Key Authenticated (Sample Models: ${models})`);
    return true;
  } catch (err) {
    console.log(`❌ FAILED: ${err.message.split('\n')[0]}`);
    return false;
  }
}

function verifyCashu() {
  process.stdout.write('4. Cashu Mint: ');
  const mints = [
    process.env.CASHU_MINT || 'https://testnut.cashu.space',
    process.env.CASHU_MINT_FALLBACK || 'https://mint.minibits.cash/Bitcoin',
  ];

  let verified = false;
  for (const mint of mints) {
    try {
      const raw = curlGet(`${mint}/v1/info`, {}, 8);
      const data = JSON.parse(raw);
      console.log(`✅ OK (${mint}) - Name: "${data.name || 'Mint'}", Pubkey: ${data.pubkey?.slice(0, 16)}...`);
      verified = true;
      break;
    } catch (err) {}
  }
  if (!verified) {
    console.log('❌ FAILED to connect to any Cashu mint');
  }
  return verified;
}

function verifyNostr() {
  console.log('5. Nostr Public Relays:');
  const relays = (process.env.RELAYS || 'wss://nos.lol,wss://relay.damus.io')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  let successCount = 0;
  for (const relay of relays) {
    process.stdout.write(`   - ${relay}: `);
    const httpUrl = relay.replace('wss://', 'https://').replace('ws://', 'http://');
    try {
      const raw = curlGet(httpUrl, { Accept: 'application/nostr+json' }, 8);
      const info = JSON.parse(raw);
      console.log(`✅ OK (NIP-11: "${info.name || info.description?.slice(0, 30)}")`);
      successCount++;
    } catch (err) {
      console.log(`⚠️ Unreachable (${err.message.split('\n')[0]})`);
    }
  }
  return successCount > 0;
}

function verifyPendingCredentials() {
  console.log('6. Wallet & Backup Status:');
  const nwc = process.env.NWC_CONNECTION_STRING;
  if (nwc && nwc.startsWith('nostr+walletconnect://')) {
    console.log('   - NWC_CONNECTION_STRING: ✅ Configured');
  } else {
    console.log('   - NWC_CONNECTION_STRING: ⚠️ Empty / Needs user wallet connection string for execution');
  }

  const hf = process.env.HUGGINGFACE_API_KEY;
  if (hf) {
    console.log('   - HUGGINGFACE_API_KEY: ✅ Configured');
  } else {
    console.log('   - HUGGINGFACE_API_KEY: ℹ️ Optional backup AI provider (Groq Cloud is active)');
  }
}

async function run() {
  if (!verifyPostgres()) allPassed = false;
  if (!verifyEsplora()) allPassed = false;
  if (!verifyGroq()) allPassed = false;
  if (!verifyCashu()) allPassed = false;
  if (!verifyNostr()) allPassed = false;
  verifyPendingCredentials();

  console.log('\n====================================================');
  if (allPassed) {
    console.log('🎉 ALL PRIMARY EXTERNAL SERVICES CONFIRMED RETURNING REAL DATA!');
  } else {
    console.log('⚠️ SOME REQUIRED CHECKS FAILED.');
  }
  console.log('====================================================');
}

run();
