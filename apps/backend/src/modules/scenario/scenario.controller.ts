import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  ValidationError,
  PaymentTarget,
  PaymentTargetKind,
  PaymentTargetPayload
} from '@kepler/shared';
import { ScenarioService } from './scenario.service';
import {
  PaymentTargetSchema,
  ScenarioIdParamSchema,
  UpdateStatusRequestSchema
} from './scenario.validators';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().nonnegative().max(1000000).optional()
});

export class ScenarioController {
  private readonly service: ScenarioService;

  constructor(service: ScenarioService) {
    this.service = service;
  }

  public async create(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      let rawTarget: unknown = req.body;
      if (
        typeof req.body === 'object' &&
        req.body !== null &&
        'target' in req.body &&
        typeof (req.body as Record<string, unknown>)['target'] === 'object'
      ) {
        rawTarget = (req.body as Record<string, unknown>)['target'];
      }

      const validatedTarget = PaymentTargetSchema.parse(rawTarget);
      let targetPayload: PaymentTargetPayload;

      if (validatedTarget.kind === PaymentTargetKind.Bitcoin) {
        targetPayload = {
          address: validatedTarget.payload.address,
          amountSats: Number(validatedTarget.payload.amountSats)
        };
      } else if (validatedTarget.kind === PaymentTargetKind.Lightning) {
        targetPayload = {
          invoice: validatedTarget.payload.invoice
        };
      } else {
        targetPayload = {
          request: validatedTarget.payload.request
        };
      }

      const target = new PaymentTarget({
        kind: validatedTarget.kind,
        payload: targetPayload
      });

      const scenario = await this.service.create({ target });
      res.status(201).json(scenario.toJSON());
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(
          new ValidationError('Invalid create scenario request body', {
            issues: error.issues
          })
        );
        return;
      }
      next(error);
    }
  }

  public async getById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const params = ScenarioIdParamSchema.parse(req.params);
      const scenario = await this.service.getById(params.id);
      res.status(200).json(scenario.toJSON());
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(
          new ValidationError('Invalid scenario id parameter', {
            issues: error.issues
          })
        );
        return;
      }
      next(error);
    }
  }

  public async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = listQuerySchema.parse(req.query);
      const scenarios = await this.service.list(query.limit, query.offset);
      res.status(200).json(scenarios.map((s) => s.toJSON()));
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(
          new ValidationError('Invalid list scenarios query parameters', {
            issues: error.issues
          })
        );
        return;
      }
      next(error);
    }
  }

  public async updateStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const params = ScenarioIdParamSchema.parse(req.params);
      const body = UpdateStatusRequestSchema.parse(req.body);
      const scenario = await this.service.updateStatus(params.id, body.status);
      res.status(200).json(scenario.toJSON());
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(
          new ValidationError('Invalid update status request', {
            issues: error.issues
          })
        );
        return;
      }
      next(error);
    }
  }

  public async delete(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const params = ScenarioIdParamSchema.parse(req.params);
      await this.service.delete(params.id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(
          new ValidationError('Invalid scenario id parameter', {
            issues: error.issues
          })
        );
        return;
      }
      next(error);
    }
  }
}
