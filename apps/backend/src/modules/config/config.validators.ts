import { z } from 'zod';
import { SupportedNetwork } from './config.types';

export const SUPPORTED_NETWORKS: readonly [SupportedNetwork, ...SupportedNetwork[]] = [
  'mainnet',
  'testnet',
  'testnet4',
  'signet',
  'regtest'
];

export const SupportedNetworkSchema = z.enum(SUPPORTED_NETWORKS);

export const UpdateNetworkRequestSchema = z
  .object({
    network: SupportedNetworkSchema
  })
  .strict();

export const AppConfigResponseSchema = z
  .object({
    network: SupportedNetworkSchema,
    updatedAt: z.string().min(1)
  })
  .strict();
