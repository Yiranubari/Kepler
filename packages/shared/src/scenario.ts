import { ValidationError } from './exceptions/ValidationError';

export enum PaymentTargetKind {
  Lightning = 'Lightning',
  Bitcoin = 'Bitcoin',
  Cashu = 'Cashu'
}

export interface LightningTargetPayload {
  readonly invoice: string;
}

export interface BitcoinTargetPayload {
  readonly address: string;
  readonly amountSats: number;
}

export interface CashuTargetPayload {
  readonly request: string;
}

export type PaymentTargetPayload =
  | LightningTargetPayload
  | BitcoinTargetPayload
  | CashuTargetPayload;

export interface PaymentTargetJSON {
  readonly kind: PaymentTargetKind;
  readonly payload: PaymentTargetPayload;
}

export class PaymentTarget {
  public readonly kind: PaymentTargetKind;
  public readonly payload: PaymentTargetPayload;

  constructor(params: {
    kind: PaymentTargetKind;
    payload: PaymentTargetPayload;
  }) {
    this.kind = params.kind;

    if (params.kind === PaymentTargetKind.Lightning) {
      const p = params.payload as Partial<LightningTargetPayload>;
      if (!p.invoice || typeof p.invoice !== 'string' || p.invoice.trim().length === 0) {
        throw new ValidationError('Lightning target requires a non-empty invoice string', { field: 'invoice', kind: PaymentTargetKind.Lightning, receivedValue: p.invoice });
      }
      this.payload = Object.freeze({ invoice: p.invoice });
    } else if (params.kind === PaymentTargetKind.Bitcoin) {
      const p = params.payload as Partial<BitcoinTargetPayload>;
      if (!p.address || typeof p.address !== 'string' || p.address.trim().length === 0) {
        throw new ValidationError('Bitcoin target requires a non-empty address string', { field: 'address', kind: PaymentTargetKind.Bitcoin, receivedValue: p.address });
      }
      if (typeof p.amountSats !== 'number' || p.amountSats <= 0) {
        throw new ValidationError('Bitcoin target requires a positive amountSats number', { field: 'amountSats', kind: PaymentTargetKind.Bitcoin, receivedValue: p.amountSats });
      }
      this.payload = Object.freeze({ address: p.address, amountSats: p.amountSats });
    } else if (params.kind === PaymentTargetKind.Cashu) {
      const p = params.payload as Partial<CashuTargetPayload>;
      if (!p.request || typeof p.request !== 'string' || p.request.trim().length === 0) {
        throw new ValidationError('Cashu target requires a non-empty request string', { field: 'request', kind: PaymentTargetKind.Cashu, receivedValue: p.request });
      }
      this.payload = Object.freeze({ request: p.request });
    } else {
      throw new ValidationError(`Unsupported payment target kind`, { field: 'kind', receivedValue: params.kind });
    }

    Object.freeze(this);
  }

  public toJSON(): PaymentTargetJSON {
    return {
      kind: this.kind,
      payload: this.payload
    };
  }

  public static fromJSON(json: PaymentTargetJSON): PaymentTarget {
    return new PaymentTarget({
      kind: json.kind,
      payload: json.payload
    });
  }
}

export enum ScenarioStatus {
  Pending = 'Pending',
  Analyzed = 'Analyzed',
  Decided = 'Decided',
  Executed = 'Executed',
  Failed = 'Failed'
}

export interface ScenarioJSON {
  readonly id: string;
  readonly target: PaymentTargetJSON;
  readonly status: ScenarioStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class Scenario {
  public readonly id: string;
  public readonly target: PaymentTarget;
  private _status: ScenarioStatus;
  public readonly createdAt: Date;
  private _updatedAt: Date;

  constructor(params: {
    id: string;
    target: PaymentTarget;
    status?: ScenarioStatus;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    if (!params.id || params.id.trim().length === 0) {
      throw new ValidationError('Scenario id cannot be empty', { field: 'id', receivedValue: params.id });
    }
    this.id = params.id;
    this.target = params.target;
    this._status = params.status ?? ScenarioStatus.Pending;
    this.createdAt = params.createdAt ?? new Date();
    this._updatedAt = params.updatedAt ?? new Date();
  }

  public get status(): ScenarioStatus {
    return this._status;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public markAnalyzed(): void {
    if (this._status !== ScenarioStatus.Pending) {
      throw new ValidationError('Scenario can only be marked Analyzed from Pending', { field: 'status', currentStatus: this._status, requiredStatus: ScenarioStatus.Pending, scenarioId: this.id });
    }
    this._status = ScenarioStatus.Analyzed;
    this._updatedAt = new Date();
  }

  public markDecided(): void {
    if (this._status !== ScenarioStatus.Analyzed) {
      throw new ValidationError('Scenario can only be marked Decided from Analyzed', { field: 'status', currentStatus: this._status, requiredStatus: ScenarioStatus.Analyzed, scenarioId: this.id });
    }
    this._status = ScenarioStatus.Decided;
    this._updatedAt = new Date();
  }

  public markExecuted(): void {
    if (this._status !== ScenarioStatus.Decided) {
      throw new ValidationError('Scenario can only be marked Executed from Decided', { field: 'status', currentStatus: this._status, requiredStatus: ScenarioStatus.Decided, scenarioId: this.id });
    }
    this._status = ScenarioStatus.Executed;
    this._updatedAt = new Date();
  }

  public markFailed(): void {
    if (this._status === ScenarioStatus.Executed) {
      throw new ValidationError('Scenario cannot be marked Failed after Executed', { field: 'status', currentStatus: this._status, scenarioId: this.id });
    }
    this._status = ScenarioStatus.Failed;
    this._updatedAt = new Date();
  }

  public toJSON(): ScenarioJSON {
    return {
      id: this.id,
      target: this.target.toJSON(),
      status: this._status,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString()
    };
  }

  public static fromJSON(json: ScenarioJSON): Scenario {
    return new Scenario({
      id: json.id,
      target: PaymentTarget.fromJSON(json.target),
      status: json.status,
      createdAt: new Date(json.createdAt),
      updatedAt: new Date(json.updatedAt)
    });
  }
}
