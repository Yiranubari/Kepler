import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '@kepler/shared';
import { ProtocolsService } from './protocols.service';
import {
  BitcoinTxRequestSchema,
  BitcoinAddressRequestSchema,
  LightningDecodeRequestSchema,
  LightningLookupRequestSchema,
  LightningListRequestSchema,
  LightningCreateRequestSchema,
  NostrEventRequestSchema,
  NostrAuthorRequestSchema,
  CashuMintRequestSchema,
  ProtocolsBalanceRequestSchema
} from './protocols.validators';

export class ProtocolsController {
  private readonly service: ProtocolsService;

  constructor(service: ProtocolsService) {
    this.service = service;
  }

  private serialize(val: unknown): unknown {
    if (typeof val === 'bigint') {
      return val.toString();
    }
    if (Array.isArray(val)) {
      return val.map((item) => this.serialize(item));
    }
    if (val !== null && typeof val === 'object') {
      const res: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val)) {
        res[k] = this.serialize(v);
      }
      return res;
    }
    return val;
  }

  public async fetchBitcoinTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = BitcoinTxRequestSchema.parse(req.body);
      const result = await this.service.fetchBitcoinTransaction(parsed.txid);
      res.status(200).json(this.serialize(result));
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Invalid Bitcoin transaction request', { issues: error.issues }));
        return;
      }
      next(error);
    }
  }

  public async fetchBitcoinAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = BitcoinAddressRequestSchema.parse(req.body);
      const result = await this.service.fetchBitcoinAddress(parsed.address);
      res.status(200).json(this.serialize(result));
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Invalid Bitcoin address request', { issues: error.issues }));
        return;
      }
      next(error);
    }
  }

  public async fetchBitcoinTip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.service.fetchBitcoinTip();
      res.status(200).json(this.serialize(result));
    } catch (error: unknown) {
      next(error);
    }
  }

  public async decodeLightningInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = LightningDecodeRequestSchema.parse(req.body);
      const result = await this.service.decodeLightningInvoice(parsed.invoice);
      res.status(200).json(this.serialize(result));
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Invalid Lightning invoice decode request', { issues: error.issues }));
        return;
      }
      next(error);
    }
  }

  public async lookupLightningInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = LightningLookupRequestSchema.parse(req.body);
      const result = await this.service.lookupLightningInvoice(parsed.paymentHash);
      res.status(200).json(this.serialize(result));
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Invalid Lightning invoice lookup request', { issues: error.issues }));
        return;
      }
      next(error);
    }
  }

  public async listLightningTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = LightningListRequestSchema.parse(req.body);
      const result = await this.service.listLightningTransactions(parsed.limit);
      res.status(200).json(this.serialize(result));
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Invalid Lightning list transactions request', { issues: error.issues }));
        return;
      }
      next(error);
    }
  }

  public async createLightningInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = LightningCreateRequestSchema.parse(req.body);
      const result = await this.service.createLightningInvoice(parsed.amountSats, parsed.memo);
      res.status(200).json(this.serialize(result));
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Invalid Lightning invoice creation request', { issues: error.issues }));
        return;
      }
      next(error);
    }
  }

  public async fetchNostrEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = NostrEventRequestSchema.parse(req.body);
      const result = await this.service.fetchNostrEvent(parsed.eventId);
      res.status(200).json(this.serialize(result));
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Invalid Nostr event request', { issues: error.issues }));
        return;
      }
      next(error);
    }
  }

  public async fetchNostrEventsByAuthor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = NostrAuthorRequestSchema.parse(req.body);
      const result = await this.service.fetchNostrEventsByAuthor(parsed.pubkey, parsed.limit);
      res.status(200).json(this.serialize(result));
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Invalid Nostr events by author request', { issues: error.issues }));
        return;
      }
      next(error);
    }
  }

  public async fetchCashuMintInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = CashuMintRequestSchema.parse(req.body);
      const result = await this.service.fetchCashuMintInfo(parsed.url);
      res.status(200).json(this.serialize(result));
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Invalid Cashu mint info request', { issues: error.issues }));
        return;
      }
      next(error);
    }
  }

  public async fetchBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = ProtocolsBalanceRequestSchema.parse(req.body);
      const result = await this.service.getBalance(parsed);
      res.status(200).json(this.serialize(result));
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Invalid balance request', { issues: error.issues }));
        return;
      }
      next(error);
    }
  }

  public async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    return this.fetchBalance(req, res, next);
  }
}
