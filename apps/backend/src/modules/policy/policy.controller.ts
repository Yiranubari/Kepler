import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PolicyService } from './policy.service';
import { PolicyResponse } from './policy.types';
import { PolicyInputError } from './policy.errors';
import {
  CheckRequestSchema,
  UpdatePolicyRequestSchema
} from './policy.validators';

export class PolicyController {
  private readonly service: PolicyService;

  constructor(service: PolicyService) {
    this.service = service;
  }

  public async get(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const policy = await this.service.get();
      const response: PolicyResponse = {
        id: policy.id,
        dailyBudgetSats: policy.dailyBudgetSats.toString(),
        perTxBudgetSats: policy.perTxBudgetSats.toString(),
        scopes: [...policy.scopes],
        allowedMints: [...policy.allowedMints],
        allowedRelays: [...policy.allowedRelays],
        allowedEsplora: [...policy.allowedEsplora],
        updatedAt: policy.updatedAt.toISOString()
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public async update(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const validated = UpdatePolicyRequestSchema.parse(req.body);
      const policy = await this.service.update(validated);
      const response: PolicyResponse = {
        id: policy.id,
        dailyBudgetSats: policy.dailyBudgetSats.toString(),
        perTxBudgetSats: policy.perTxBudgetSats.toString(),
        scopes: [...policy.scopes],
        allowedMints: [...policy.allowedMints],
        allowedRelays: [...policy.allowedRelays],
        allowedEsplora: [...policy.allowedEsplora],
        updatedAt: policy.updatedAt.toISOString()
      };
      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstIssue = error.issues[0];
        next(
          new PolicyInputError(
            `Invalid update policy request: ${firstIssue?.message ?? 'validation error'}`,
            {
              field: firstIssue?.path.join('.') ?? 'body',
              reason: firstIssue?.message ?? 'VALIDATION_FAILED'
            }
          )
        );
        return;
      }
      next(error);
    }
  }

  public async check(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const validated = CheckRequestSchema.parse(req.body);
      const result = await this.service.check(validated);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstIssue = error.issues[0];
        next(
          new PolicyInputError(
            `Invalid check request: ${firstIssue?.message ?? 'validation error'}`,
            {
              field: firstIssue?.path.join('.') ?? 'body',
              reason: firstIssue?.message ?? 'VALIDATION_FAILED'
            }
          )
        );
        return;
      }
      next(error);
    }
  }
}
