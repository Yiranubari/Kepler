import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, NotFoundError } from '@kepler/shared';
import { TaintService } from './taint.service';
import {
  AnalyzeRequestSchema,
  AnalyzeResponseSchema,
  GraphResponseSchema,
  FindPathsRequestSchema,
  FindPathsResponseSchema
} from './taint.validators';
import { TaintIngestPayload } from './taint.types';

export class TaintController {
  private readonly service: TaintService;

  constructor(service: TaintService) {
    this.service = service;
  }

  public async analyze(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const validated = AnalyzeRequestSchema.parse(req.body);
      const ingestPayload: TaintIngestPayload = validated.ingestData ?? {
        bitcoin: validated.bitcoin,
        lightning: validated.lightning,
        nostr: validated.nostr,
        cashu: validated.cashu
      };

      const result = await this.service.analyze(
        validated.scenarioId,
        ingestPayload
      );
      const responsePayload = {
        graph: result.graph.toJSON(),
        scenarioId: result.scenarioId,
        analyzedAt: result.analyzedAt,
        ruleCount: result.ruleCount,
        nodeCount: result.nodeCount,
        edgeCount: result.edgeCount,
        pathCount: result.pathCount
      };
      const validatedResponse = AnalyzeResponseSchema.parse(responsePayload);
      res.status(200).json(validatedResponse);
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(
          new ValidationError('Invalid analyze request body', {
            issues: error.issues
          })
        );
        return;
      }
      next(error);
    }
  }

  public async getGraph(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const scenarioId = req.params['id'] ?? req.params['scenarioId'];
      if (
        !scenarioId ||
        typeof scenarioId !== 'string' ||
        scenarioId.trim().length === 0
      ) {
        throw new ValidationError('Scenario id is required in path parameter');
      }

      const graph = await this.service.getGraph(scenarioId.trim());
      if (!graph) {
        throw new NotFoundError('Graph not found for scenario', {
          scenarioId: scenarioId.trim()
        });
      }

      const validatedResponse = GraphResponseSchema.parse(graph.toJSON());
      res.status(200).json(validatedResponse);
    } catch (error) {
      next(error);
    }
  }

  public async findPaths(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const validated = FindPathsRequestSchema.parse(req.body);
      const paths = await this.service.findPaths(
        validated.scenarioId,
        validated.fromNodeId,
        validated.toNodeId,
        validated.maxPaths
      );

      const serializedPaths = paths.map((p) => p.toJSON());
      const responsePayload = { paths: serializedPaths };
      const validatedResponse = FindPathsResponseSchema.parse(responsePayload);
      res.status(200).json(validatedResponse);
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(
          new ValidationError('Invalid find paths request body', {
            issues: error.issues
          })
        );
        return;
      }
      next(error);
    }
  }
}
