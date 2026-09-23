export enum PolicyScope {
  Read = 'Read',
  Propose = 'Propose',
  Send = 'Send',
  Publish = 'Publish'
}

export interface PolicyJSON {
  readonly id: string;
  readonly dailyBudgetSats: number;
  readonly perTxBudgetSats: number;
  readonly scopes: readonly PolicyScope[];
  readonly allowedMints: readonly string[];
  readonly allowedRelays: readonly string[];
  readonly allowedEsplora: readonly string[];
  readonly updatedAt: string;
}

export class Policy {
  public readonly id: string;
  public readonly dailyBudgetSats: number;
  public readonly perTxBudgetSats: number;
  public readonly scopes: readonly PolicyScope[];
  public readonly allowedMints: readonly string[];
  public readonly allowedRelays: readonly string[];
  public readonly allowedEsplora: readonly string[];
  public readonly updatedAt: Date;

  constructor(params: {
    id: string;
    dailyBudgetSats: number;
    perTxBudgetSats: number;
    scopes: PolicyScope[];
    allowedMints: string[];
    allowedRelays: string[];
    allowedEsplora: string[];
    updatedAt?: Date;
  }) {
    if (!params.id || params.id.trim().length === 0) {
      throw new Error('Policy id cannot be empty');
    }
    if (params.dailyBudgetSats < 0) {
      throw new Error('Policy dailyBudgetSats cannot be negative');
    }
    if (params.perTxBudgetSats < 0) {
      throw new Error('Policy perTxBudgetSats cannot be negative');
    }
    if (params.perTxBudgetSats > params.dailyBudgetSats) {
      throw new Error('Policy perTxBudgetSats cannot exceed dailyBudgetSats');
    }
    this.id = params.id;
    this.dailyBudgetSats = params.dailyBudgetSats;
    this.perTxBudgetSats = params.perTxBudgetSats;
    this.scopes = Object.freeze([...params.scopes]);
    this.allowedMints = Object.freeze([...params.allowedMints]);
    this.allowedRelays = Object.freeze([...params.allowedRelays]);
    this.allowedEsplora = Object.freeze([...params.allowedEsplora]);
    this.updatedAt = params.updatedAt ?? new Date();
    Object.freeze(this);
  }

  public canRead(): boolean {
    return this.scopes.includes(PolicyScope.Read);
  }

  public canPropose(): boolean {
    return this.scopes.includes(PolicyScope.Propose);
  }

  public canSend(amountSats: number, spentTodaySats: number): boolean {
    if (!this.scopes.includes(PolicyScope.Send)) {
      return false;
    }
    if (amountSats <= 0) {
      return false;
    }
    if (amountSats > this.perTxBudgetSats) {
      return false;
    }
    if (spentTodaySats + amountSats > this.dailyBudgetSats) {
      return false;
    }
    return true;
  }

  public canPublish(): boolean {
    return this.scopes.includes(PolicyScope.Publish);
  }

  public isMintAllowed(mint: string): boolean {
    return this.allowedMints.includes(mint);
  }

  public isRelayAllowed(relay: string): boolean {
    return this.allowedRelays.includes(relay);
  }

  public isEsploraAllowed(url: string): boolean {
    return this.allowedEsplora.includes(url);
  }

  public toJSON(): PolicyJSON {
    return {
      id: this.id,
      dailyBudgetSats: this.dailyBudgetSats,
      perTxBudgetSats: this.perTxBudgetSats,
      scopes: this.scopes,
      allowedMints: this.allowedMints,
      allowedRelays: this.allowedRelays,
      allowedEsplora: this.allowedEsplora,
      updatedAt: this.updatedAt.toISOString()
    };
  }

  public static fromJSON(json: PolicyJSON): Policy {
    return new Policy({
      id: json.id,
      dailyBudgetSats: json.dailyBudgetSats,
      perTxBudgetSats: json.perTxBudgetSats,
      scopes: [...json.scopes],
      allowedMints: [...json.allowedMints],
      allowedRelays: [...json.allowedRelays],
      allowedEsplora: [...json.allowedEsplora],
      updatedAt: new Date(json.updatedAt)
    });
  }
}
