import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '@kepler/shared';
import { OnchainService } from './onchain.service';
import {
  DeriveRequestSchema,
  UtxosRequestSchema,
  FeesRequestSchema,
  PsbtBuildRequestSchema,
  PsbtBroadcastRequestSchema
} from './onchain.validators';

export class OnchainController {
  private readonly service: OnchainService;

  constructor(service: OnchainService) {
    this.service = service;
  }

  public async derive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = DeriveRequestSchema.parse(req.body);
      const result = await this.service.derive(parsed);
      res.status(200).json(result);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Invalid derive request body', { issues: error.issues }));
        return;
      }
      next(error);
    }
  }

  public async utxos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = UtxosRequestSchema.parse(req.body);
      const result = await this.service.utxos(parsed);
      res.status(200).json(result);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Invalid utxos request body', { issues: error.issues }));
        return;
      }
      next(error);
    }
  }

  public async fees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = FeesRequestSchema.parse(req.body);
      const result = await this.service.fees(parsed);
      res.status(200).json(result);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Invalid fees request body', { issues: error.issues }));
        return;
      }
      next(error);
    }
  }

  public async buildPsbt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = PsbtBuildRequestSchema.parse(req.body);
      const result = await this.service.buildPsbt(parsed);
      res.status(200).json(result);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Invalid PSBT build request body', { issues: error.issues }));
        return;
      }
      next(error);
    }
  }

  public async broadcast(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = PsbtBroadcastRequestSchema.parse(req.body);
      const result = await this.service.broadcast(parsed);
      res.status(200).json(result);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Invalid PSBT broadcast request body', { issues: error.issues }));
        return;
      }
      next(error);
    }
  }
}
