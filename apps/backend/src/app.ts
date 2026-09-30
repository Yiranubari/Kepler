import express, { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { env } from './config/env';
import { RATE_LIMIT_WINDOWS_MS } from './config/constants';
import { RateLimiter } from './services/rateLimiter';
import { KeplerLogger } from './services/logger';
import { requestLogger } from './middleware/requestLogger';
import { errorMiddleware } from './middleware/error';
import {
  TaintConfig,
  createDefaultRuleRegistry,
  TaintScorer,
  TaintController,
  createTaintRoutes
} from './modules/taint';
import { TaintRepository } from './modules/taint/taint.repository';
import { TaintService } from './modules/taint/taint.service';
import {
  ProofRepository,
  ClaimRegistry,
  ProofService,
  ProofController,
  createProofRoutes
} from './modules/proof';
import {
  ScenarioRepository,
  ScenarioService,
  ScenarioController,
  createScenarioRoutes
} from './modules/scenario';
import { BitcoinConfig, BitcoinClient } from '@kepler/bitcoin';
import { LightningConfig, LightningClient } from '@kepler/lightning';
import { NostrConfig, NostrClient } from '@kepler/nostr';
import { CashuConfig, CashuClient } from '@kepler/cashu';
import {
  ProtocolsConfig,
  ProtocolsService,
  ProtocolsController,
  createProtocolsRoutes
} from './modules/protocols';
import {
  OnchainService,
  OnchainController,
  createOnchainRoutes
} from './modules/onchain';

const defaultLimiterInstance = new RateLimiter({
  read: { limit: env.RATE_LIMIT_READ_PER_MINUTE, windowMs: RATE_LIMIT_WINDOWS_MS.read },
  propose: { limit: env.RATE_LIMIT_PROPOSE_PER_MINUTE, windowMs: RATE_LIMIT_WINDOWS_MS.propose },
  send: { limit: env.RATE_LIMIT_SEND_PER_HOUR, windowMs: RATE_LIMIT_WINDOWS_MS.send },
  publish: { limit: env.RATE_LIMIT_PUBLISH_PER_HOUR, windowMs: RATE_LIMIT_WINDOWS_MS.publish }
});

export function getLimiter(): RateLimiter {
  return defaultLimiterInstance;
}

let mempoolFallbackConfigured = false;

function ensureMempoolFallback(): void {
  if (mempoolFallbackConfigured) return;
  mempoolFallbackConfigured = true;
  const originalFetch = globalThis.fetch;
  if (!originalFetch) return;
  globalThis.fetch = async (input, init) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
    if (urlStr.includes('mempool.space')) {
      const fallbackUrl = urlStr.replace('mempool.space', 'mempool.emzy.de');
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        timeoutId.unref();
        const res = await originalFetch(input, { ...init, signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) return res;
      } catch {
        return originalFetch(fallbackUrl, init);
      }
      return originalFetch(fallbackUrl, init);
    }
    return originalFetch(input, init);
  };
}

export function createApp(
  limiter: RateLimiter,
  logger: KeplerLogger,
  prismaClient?: PrismaClient,
  protocolsConfig?: ProtocolsConfig
): Express {
  ensureMempoolFallback();
  const app = express();

  app.use(requestLogger(logger));
  app.use(express.json());

  const prisma = prismaClient ?? new PrismaClient();
  const taintConfig = TaintConfig.fromEnv();
  const taintRegistry = createDefaultRuleRegistry();
  const taintScorer = new TaintScorer();
  const taintRepository = new TaintRepository(prisma);
  const taintService = new TaintService(
    taintConfig,
    taintRegistry,
    taintScorer,
    taintRepository,
    logger
  );
  const taintController = new TaintController(taintService);
  const taintRoutes = createTaintRoutes(taintController, limiter);

  const proofRepository = new ProofRepository(prisma);
  const proofRegistry = ClaimRegistry.createDefault();
  const proofService = new ProofService(proofRegistry, proofRepository, logger);
  const proofController = new ProofController(proofService);
  const proofRoutes = createProofRoutes(proofController, limiter);

  const scenarioRepository = new ScenarioRepository(prisma);
  const scenarioService = new ScenarioService(scenarioRepository, logger);
  const scenarioController = new ScenarioController(scenarioService);
  const scenarioRoutes = createScenarioRoutes(scenarioController, limiter);

  let activeProtocolsConfig: ProtocolsConfig;
  if (protocolsConfig) {
    activeProtocolsConfig = protocolsConfig;
  } else {
    const bitcoinConfig = BitcoinConfig.fromEnv({
      ...process.env,
      BITCOIN_NETWORK: process.env.BITCOIN_NETWORK || 'mainnet'
    });
    const bitcoinClient = new BitcoinClient(bitcoinConfig, logger);

    const lightningConfig = LightningConfig.fromEnv();
    const lightningClient = new LightningClient(lightningConfig, logger);

    const nostrConfig = NostrConfig.fromEnv();
    const nostrClient = new NostrClient(nostrConfig, logger);

    const cashuConfig = CashuConfig.fromEnv();
    const cashuClient = new CashuClient(cashuConfig, logger);

    activeProtocolsConfig = {
      bitcoinClient,
      lightningClient,
      nostrClient,
      cashuClient
    };
  }

  const protocolsService = new ProtocolsService(activeProtocolsConfig, logger);
  const protocolsController = new ProtocolsController(protocolsService);
  const protocolsRoutes = createProtocolsRoutes(protocolsController, limiter);

  const onchainService = new OnchainService(activeProtocolsConfig.bitcoinClient, logger);
  const onchainController = new OnchainController(onchainService);
  const onchainRoutes = createOnchainRoutes(onchainController, limiter);

  app.use('/api', taintRoutes);
  app.use('/api/proof', proofRoutes);
  app.use('/api/scenarios', scenarioRoutes);
  app.use('/api/protocols', protocolsRoutes);
  app.use('/api/onchain', onchainRoutes);

  app.use(errorMiddleware);

  return app;
}
