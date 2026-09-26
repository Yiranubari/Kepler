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

const defaultLimiterInstance = new RateLimiter({
  read: { limit: env.RATE_LIMIT_READ_PER_MINUTE, windowMs: RATE_LIMIT_WINDOWS_MS.read },
  propose: { limit: env.RATE_LIMIT_PROPOSE_PER_MINUTE, windowMs: RATE_LIMIT_WINDOWS_MS.propose },
  send: { limit: env.RATE_LIMIT_SEND_PER_HOUR, windowMs: RATE_LIMIT_WINDOWS_MS.send },
  publish: { limit: env.RATE_LIMIT_PUBLISH_PER_HOUR, windowMs: RATE_LIMIT_WINDOWS_MS.publish }
});

export function getLimiter(): RateLimiter {
  return defaultLimiterInstance;
}

export function createApp(
  limiter: RateLimiter,
  logger: KeplerLogger,
  prismaClient?: PrismaClient
): Express {
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

  app.use('/api', taintRoutes);
  app.use('/api/proof', proofRoutes);
  app.use('/api/scenarios', scenarioRoutes);

  app.use(errorMiddleware);

  return app;
}
