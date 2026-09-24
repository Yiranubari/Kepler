export { TaintService } from './taint.service';
export { TaintEngine } from './taint.engine';
export { TaintConfig } from './taint.types';
export type {
  TaintConfigParams,
  BitcoinIngestData,
  LightningIngestData,
  NostrIngestData,
  CashuIngestData,
  TaintIngestPayload,
  TaintAnalysisResult,
  TaintRepository
} from './taint.types';
export { TaintScorer } from './taint.scorer';
export { TaintRuleRegistry } from './rules/registry';
export { TaintController } from './taint.controller';
export { createTaintRoutes } from './taint.routes';
export {
  TaintEngineError,
  TaintIngestError,
  TaintRuleError,
  TaintScoringError,
  TaintPathError,
  TaintPersistenceError
} from './taint.errors';
export type {
  TaintRule,
  TaintRuleContext,
  TaintRuleResult
} from './rules/rule.interface';
export {
  TaintIngestPayloadSchema,
  AnalyzeRequestSchema,
  AnalyzeResponseSchema,
  GraphResponseSchema,
  FindPathsRequestSchema,
  FindPathsResponseSchema
} from './taint.validators';
