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
  ScenarioJSON
};

export interface CreateScenarioInput {
  readonly id?: string;
  readonly target: PaymentTarget;
}

export interface UpdateScenarioStatusInput {
  readonly status: ScenarioStatus;
}

export type ScenarioResponse = ScenarioJSON;

export type {
  CreateScenarioRequest,
  ScenarioIdParam,
  UpdateStatusRequest,
  ListScenariosResponse
} from './scenario.validators';
