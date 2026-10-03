import {
  PaymentTarget,
  PaymentTargetKind,
  PaymentTargetPayload,
  PaymentTargetJSON,
  LightningTargetPayload,
  BitcoinTargetPayload,
  CashuTargetPayload,
  ScenarioStatus,
  ScenarioJSON,
  Scenario
} from '@kepler/shared';
import { SupportedNetwork } from '../config/config.types';

export {
  PaymentTarget,
  PaymentTargetKind,
  ScenarioStatus,
  Scenario
};

export type {
  PaymentTargetPayload,
  PaymentTargetJSON,
  LightningTargetPayload,
  BitcoinTargetPayload,
  CashuTargetPayload,
  ScenarioJSON,
  SupportedNetwork
};

export interface CreateScenarioInput {
  readonly id?: string;
  readonly target: PaymentTarget;
  readonly network: SupportedNetwork;
}

export interface ListScenariosQueryInput {
  readonly limit?: number;
  readonly offset?: number;
  readonly network?: SupportedNetwork;
}

export interface UpdateScenarioStatusInput {
  readonly status: ScenarioStatus;
}

export type ScenarioResponse = ScenarioJSON & {
  readonly network?: SupportedNetwork;
};

export type {
  CreateScenarioRequest,
  ScenarioIdParam,
  UpdateStatusRequest,
  ListScenariosResponse,
  ListScenariosQuery
} from './scenario.validators';
