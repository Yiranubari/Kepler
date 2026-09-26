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
export { TaintRuleRegistry, createDefaultRuleRegistry } from './rules/registry';
export { PublishedByRule } from './rules/publishedBy.rule';
export { SamePaymentHashRule } from './rules/samePaymentHash.rule';
export { SamePreimageRule } from './rules/samePreimage.rule';
export { TemporalWindowRule } from './rules/temporalWindow.rule';
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
