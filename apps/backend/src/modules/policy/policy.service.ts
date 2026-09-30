import { Policy, PolicyScope, KeplerLogger } from '@kepler/shared';
import { PolicyRepository } from './policy.repository';
import {
  CheckRequest,
  CheckResponse,
  UpdatePolicyRequest
} from './policy.types';
import {
  PolicyScopeError,
  PolicyBudgetError,
  PolicyAllowlistError,
  PolicyInputError
} from './policy.errors';
import {
  CheckRequestSchema,
  UpdatePolicyRequestSchema
} from './policy.validators';

export class PolicyService {
  private readonly repository: PolicyRepository;
  private readonly logger: KeplerLogger;

  constructor(repository: PolicyRepository, logger: KeplerLogger) {
    this.repository = repository;
    this.logger = logger;
  }

  public async initialize(): Promise<void> {
    await this.repository.ensureDefault();
    this.logger.info('Policy service initialized');
  }

  public async get(): Promise<Policy> {
    return this.repository.get();
  }

  public async update(request: UpdatePolicyRequest): Promise<Policy> {
    const validation = UpdatePolicyRequestSchema.safeParse(request);
    if (!validation.success) {
      const issue = validation.error.issues[0];
      const field = issue ? issue.path.join('.') : 'request';
      const reason = issue ? issue.message : 'Invalid request payload';
      throw new PolicyInputError(`Invalid policy update request: ${reason}`, {
        field,
        reason
      });
    }

    if (BigInt(request.perTxBudgetSats) > BigInt(request.dailyBudgetSats)) {
      throw new PolicyInputError('Policy perTxBudgetSats cannot exceed dailyBudgetSats', {
        field: 'perTxBudgetSats',
        reason: 'PER_TX_EXCEEDS_DAILY'
      });
    }

    const policy = new Policy({
      id: 'default',
      dailyBudgetSats: Number(request.dailyBudgetSats),
      perTxBudgetSats: Number(request.perTxBudgetSats),
      scopes: [...request.scopes],
      allowedMints: [...request.allowedMints],
      allowedRelays: [...request.allowedRelays],
      allowedEsplora: [...request.allowedEsplora],
      updatedAt: new Date()
    });

    await this.repository.upsert(policy);

    this.logger.info('Policy updated', {
      scopes: [...policy.scopes]
    });
    this.logger.debug('Policy budgets updated', {
      dailyBudgetSats: request.dailyBudgetSats,
      perTxBudgetSats: request.perTxBudgetSats
    });

    return policy;
  }

  public async check(request: CheckRequest): Promise<CheckResponse> {
    const startTimeNs = process.hrtime.bigint();
    const validation = CheckRequestSchema.safeParse(request);
    if (!validation.success) {
      const issue = validation.error.issues[0];
      const field = issue ? issue.path.join('.') : 'request';
      const reason = issue ? issue.message : 'Invalid check request';
      throw new PolicyInputError(`Invalid check request: ${reason}`, {
        field,
        reason
      });
    }

    const policy = await this.repository.get();

    let spentToday = 0n;

    switch (request.kind) {
      case 'read': {
        if (!policy.canRead()) {
          throw new PolicyScopeError('Policy scope does not permit read', {
            scope: 'read',
            operation: 'read'
          });
        }
        spentToday = await this.repository.sumSpentSince(this.startOfUtcDay());
        break;
      }
      case 'propose': {
        if (!policy.canPropose()) {
          throw new PolicyScopeError('Policy scope does not permit propose', {
            scope: 'propose',
            operation: 'propose'
          });
        }
        spentToday = await this.repository.sumSpentSince(this.startOfUtcDay());
        break;
      }
      case 'send': {
        if (!policy.scopes.includes(PolicyScope.Send)) {
          throw new PolicyScopeError('Policy scope does not permit send', {
            scope: 'send',
            operation: 'send'
          });
        }

        const amountBigInt = BigInt(request.amountSats);

        if (amountBigInt > BigInt(policy.perTxBudgetSats)) {
          throw new PolicyBudgetError('Per-transaction budget exceeded', {
            limitType: 'perTx',
            limitSats: policy.perTxBudgetSats,
            spentSats: 0n,
            requestedSats: request.amountSats
          });
        }

        spentToday = await this.repository.sumSpentSince(this.startOfUtcDay());

        if (spentToday + amountBigInt > BigInt(policy.dailyBudgetSats)) {
          throw new PolicyBudgetError('Daily budget exceeded', {
            limitType: 'daily',
            limitSats: policy.dailyBudgetSats,
            spentSats: spentToday,
            requestedSats: request.amountSats
          });
        }

        if (request.protocol === 'Cashu' && request.mint) {
          if (!policy.isMintAllowed(request.mint)) {
            throw new PolicyAllowlistError(`Mint is not allowed: ${request.mint}`, {
              kind: 'mint',
              value: request.mint,
              allowed: policy.allowedMints
            });
          }
        }
        break;
      }
      case 'publish': {
        if (!policy.canPublish()) {
          throw new PolicyScopeError('Policy scope does not permit publish', {
            scope: 'publish',
            operation: 'publish'
          });
        }
        spentToday = await this.repository.sumSpentSince(this.startOfUtcDay());
        break;
      }
    }

    const durationMs = Number((process.hrtime.bigint() - startTimeNs) / 1000000n);
    const debugContext: Record<string, unknown> = {
      kind: request.kind,
      durationMs
    };
    if (request.kind === 'send') {
      debugContext.amountSats = request.amountSats;
    }
    this.logger.debug('Policy check passed', debugContext);

    const remainingBigInt =
      BigInt(policy.dailyBudgetSats) > spentToday
        ? BigInt(policy.dailyBudgetSats) - spentToday
        : 0n;

    return {
      allowed: true,
      limits: {
        dailyRemainingSats: remainingBigInt.toString(),
        perTxLimitSats: policy.perTxBudgetSats.toString()
      }
    };
  }

  private startOfUtcDay(): Date {
    const now = new Date(Date.now());
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
    );
  }
}
