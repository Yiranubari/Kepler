import { Request, Response, NextFunction } from 'express';
import { ConfigService } from './config.service';
import { AppConfigResponse } from './config.types';
import { UpdateNetworkRequestSchema, SUPPORTED_NETWORKS } from './config.validators';
import { ConfigNetworkInvalidError } from './config.errors';

export class ConfigController {
  private readonly service: ConfigService;

  public constructor(service: ConfigService) {
    this.service = service;
  }

  public async get(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const config = await this.service.get();
      const response: AppConfigResponse = {
        network: config.network,
        updatedAt: config.updatedAt.toISOString()
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public async setNetwork(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const parseResult = UpdateNetworkRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        const rawValue = typeof req.body === 'object' && req.body !== null && 'network' in req.body
          ? String((req.body as { network: unknown }).network)
          : '';
        throw new ConfigNetworkInvalidError(
          'The specified network is not supported. Use a supported Bitcoin network and try again.',
          {
            value: rawValue,
            allowed: SUPPORTED_NETWORKS
          }
        );
      }

      const config = await this.service.setNetwork(parseResult.data.network);
      const response: AppConfigResponse = {
        network: config.network,
        updatedAt: config.updatedAt.toISOString()
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
