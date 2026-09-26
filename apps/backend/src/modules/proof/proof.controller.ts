import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, NotFoundError } from '@kepler/shared';
import { ProofService } from './proof.service';
import {
  BuildClaimRequestSchema,
  VerifyClaimRequestSchema
} from './proof.validators';

export class ProofController {
  private readonly service: ProofService;

  constructor(service: ProofService) {
    this.service = service;
  }

  public async build(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const validated = BuildClaimRequestSchema.parse(req.body);
      const bundle = await this.service.build(
        validated.type,
        validated.input,
        { scenarioId: validated.scenarioId }
      );
      res.status(200).json(bundle.toJSON());
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(
          new ValidationError('Invalid build claim request body', {
            issues: error.issues
          })
        );
        return;
      }
      next(error);
    }
  }

  public async verify(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const validated = VerifyClaimRequestSchema.parse(req.body);
      const bundleJson =
        'bundle' in validated && validated.bundle !== undefined
          ? validated.bundle
          : validated;
      const result = await this.service.verify(bundleJson);
      res.status(200).json(result.toJSON());
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(
          new ValidationError('Invalid verify claim request body', {
            issues: error.issues
          })
        );
        return;
      }
      next(error);
    }
  }

  public async getByHash(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const bundleHash = req.params['bundleHash'] ? req.params['bundleHash'].trim() : '';
      if (bundleHash.length === 0) {
        throw new ValidationError('Bundle hash parameter is required', {
          param: 'bundleHash'
        });
      }

      const bundle = await this.service.getByHash(bundleHash);
      if (!bundle) {
        throw new NotFoundError('Evidence bundle not found', {
          resource: 'EvidenceBundle',
          bundleHash
        });
      }

      res.status(200).json(bundle.toJSON());
    } catch (error) {
      next(error);
    }
  }

  public async listByScenario(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const scenarioId = req.params['scenarioId'] ? req.params['scenarioId'].trim() : '';
      if (scenarioId.length === 0) {
        throw new ValidationError('Scenario ID parameter is required', {
          param: 'scenarioId'
        });
      }

      const bundles = await this.service.listByScenario(scenarioId);
      res.status(200).json(bundles.map((bundle) => bundle.toJSON()));
    } catch (error) {
      next(error);
    }
  }
}
