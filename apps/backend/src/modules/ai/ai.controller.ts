import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '@kepler/shared';
import { AIService } from './ai.service';
import {
  ExplainGraphRequestSchema,
  SummarizeEvidenceRequestSchema,
  SuggestRouteRequestSchema,
  AIResponseSchema
} from './ai.validators';

export class AIController {
  private readonly service: AIService;

  constructor(service: AIService) {
    this.service = service;
  }

  public async explain(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const validated = ExplainGraphRequestSchema.parse(req.body);
      const result = await this.service.explainGraph(validated.scenarioId);
      const validatedResponse = AIResponseSchema.parse(result);
      res.status(200).json(validatedResponse);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        next(
          new ValidationError('Invalid explain graph request body', {
            issues: error.issues
          })
        );
        return;
      }
      next(error);
    }
  }

  public async summarize(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const validated = SummarizeEvidenceRequestSchema.parse(req.body);
      const result = await this.service.summarizeEvidence(validated.bundleHash);
      const validatedResponse = AIResponseSchema.parse(result);
      res.status(200).json(validatedResponse);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        next(
          new ValidationError('Invalid summarize evidence request body', {
            issues: error.issues
          })
        );
        return;
      }
      next(error);
    }
  }

  public async suggest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const validated = SuggestRouteRequestSchema.parse(req.body);
      const result = await this.service.suggestRoute(validated);
      const validatedResponse = AIResponseSchema.parse(result);
      res.status(200).json(validatedResponse);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        next(
          new ValidationError('Invalid suggest route request body', {
            issues: error.issues
          })
        );
        return;
      }
      next(error);
    }
  }
}
