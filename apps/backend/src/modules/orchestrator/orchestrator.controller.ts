import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '@kepler/shared';
import { OrchestratorService } from './orchestrator.service';
import { OrchestrateRequestSchema } from './orchestrator.validators';

export class OrchestratorController {
  private readonly service: OrchestratorService;

  constructor(service: OrchestratorService) {
    this.service = service;
  }

  public async orchestrate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const validated = OrchestrateRequestSchema.parse(req.body);
      const result = await this.service.orchestrate(validated);
      const statusCode = result.execution.status === 'succeeded' ? 200 : 202;
      res.status(statusCode).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(
          new ValidationError('Invalid orchestrate request body', {
            issues: error.issues
          })
        );
        return;
      }
      next(error);
    }
  }
}
