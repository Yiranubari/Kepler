import express, { Express, Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { KeplerError, NotFoundError, ValidationError, PolicyScope } from '@kepler/shared';
import { errorMiddleware } from '../../src/middleware/error';
import {
  PolicyNotFoundError,
  PolicyScopeError,
  PolicyBudgetError,
  PolicyAllowlistError,
  PolicyInputError
} from '../../src/modules/policy/policy.errors';
import {
  CheckRequest,
  CheckResponse,
  UpdatePolicyRequest,
  PolicyResponse
} from '../../src/modules/policy/policy.types';

describe('Policy Errors', () => {
  describe('PolicyNotFoundError', () => {
    it('initializes with code, message, and context', () => {
      const err = new PolicyNotFoundError('Policy not found', { id: 'default' });
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err).toBeInstanceOf(KeplerError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('POLICY_NOT_FOUND');
      expect(err.message).toBe('Policy not found');
      expect(err.context).toEqual({ id: 'default' });
      expect(err.name).toBe('PolicyNotFoundError');
    });

    it('attaches optional cause', () => {
      const cause = new Error('Database connection failed');
      const err = new PolicyNotFoundError('Policy not found', { id: 'default' }, cause);
      expect(err.cause).toBe(cause);
    });

    it('serializes to JSON correctly', () => {
      const err = new PolicyNotFoundError('Policy not found', { id: 'default' });
      expect(err.toJSON()).toEqual({
        name: 'PolicyNotFoundError',
        code: 'POLICY_NOT_FOUND',
        message: 'Policy not found',
        context: { id: 'default' }
      });
    });
  });

  describe('PolicyScopeError', () => {
    it('initializes with code, message, and context', () => {
      const err = new PolicyScopeError('Scope violation', {
        scope: PolicyScope.Send,
        operation: 'send'
      });
      expect(err).toBeInstanceOf(KeplerError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('POLICY_SCOPE_VIOLATION');
      expect(err.message).toBe('Scope violation');
      expect(err.context).toEqual({
        scope: PolicyScope.Send,
        operation: 'send'
      });
      expect(err.name).toBe('PolicyScopeError');
    });

    it('attaches optional cause', () => {
      const cause = new Error('Underlying scope failure');
      const err = new PolicyScopeError(
        'Scope violation',
        { scope: 'Publish', operation: 'publish' },
        cause
      );
      expect(err.cause).toBe(cause);
    });

    it('serializes to JSON correctly', () => {
      const err = new PolicyScopeError('Scope violation', {
        scope: PolicyScope.Read,
        operation: 'read'
      });
      expect(err.toJSON()).toEqual({
        name: 'PolicyScopeError',
        code: 'POLICY_SCOPE_VIOLATION',
        message: 'Scope violation',
        context: {
          scope: PolicyScope.Read,
          operation: 'read'
        }
      });
    });
  });

  describe('PolicyBudgetError', () => {
    it('initializes with perTx limit details', () => {
      const err = new PolicyBudgetError('Per-transaction budget exceeded', {
        limitType: 'perTx',
        limitSats: '50000',
        spentSats: '0',
        requestedSats: '60000'
      });
      expect(err).toBeInstanceOf(KeplerError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('POLICY_BUDGET_VIOLATION');
      expect(err.message).toBe('Per-transaction budget exceeded');
      expect(err.context).toEqual({
        limitType: 'perTx',
        limitSats: '50000',
        spentSats: '0',
        requestedSats: '60000'
      });
      expect(err.name).toBe('PolicyBudgetError');
    });

    it('initializes with daily limit details', () => {
      const err = new PolicyBudgetError('Daily budget exceeded', {
        limitType: 'daily',
        limitSats: '100000',
        spentSats: '90000',
        requestedSats: '20000'
      });
      expect(err.code).toBe('POLICY_BUDGET_VIOLATION');
      expect(err.context).toEqual({
        limitType: 'daily',
        limitSats: '100000',
        spentSats: '90000',
        requestedSats: '20000'
      });
    });

    it('attaches optional cause', () => {
      const cause = new Error('Ledger check failure');
      const err = new PolicyBudgetError(
        'Daily budget exceeded',
        {
          limitType: 'daily',
          limitSats: '100000',
          spentSats: '90000',
          requestedSats: '20000'
        },
        cause
      );
      expect(err.cause).toBe(cause);
    });

    it('serializes to JSON correctly', () => {
      const err = new PolicyBudgetError('Daily budget exceeded', {
        limitType: 'daily',
        limitSats: '100000',
        spentSats: '90000',
        requestedSats: '20000'
      });
      expect(err.toJSON()).toEqual({
        name: 'PolicyBudgetError',
        code: 'POLICY_BUDGET_VIOLATION',
        message: 'Daily budget exceeded',
        context: {
          limitType: 'daily',
          limitSats: '100000',
          spentSats: '90000',
          requestedSats: '20000'
        }
      });
    });
  });

  describe('PolicyAllowlistError', () => {
    it('initializes with mint allowlist violation', () => {
      const err = new PolicyAllowlistError('Mint is not allowed', {
        kind: 'mint',
        value: 'https://untrusted.mint',
        allowed: ['https://trusted.mint']
      });
      expect(err).toBeInstanceOf(KeplerError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('POLICY_ALLOWLIST_VIOLATION');
      expect(err.message).toBe('Mint is not allowed');
      expect(err.context).toEqual({
        kind: 'mint',
        value: 'https://untrusted.mint',
        allowed: ['https://trusted.mint']
      });
      expect(err.name).toBe('PolicyAllowlistError');
    });

    it('initializes with relay allowlist violation', () => {
      const err = new PolicyAllowlistError('Relay is not allowed', {
        kind: 'relay',
        value: 'wss://untrusted.relay',
        allowed: ['wss://trusted.relay']
      });
      expect(err.code).toBe('POLICY_ALLOWLIST_VIOLATION');
      expect(err.context.kind).toBe('relay');
    });

    it('initializes with esplora allowlist violation', () => {
      const err = new PolicyAllowlistError('Esplora URL is not allowed', {
        kind: 'esplora',
        value: 'https://evil.mempool.space/api',
        allowed: ['https://mempool.space/api']
      });
      expect(err.code).toBe('POLICY_ALLOWLIST_VIOLATION');
      expect(err.context.kind).toBe('esplora');
    });

    it('attaches optional cause', () => {
      const cause = new Error('URL parse failure');
      const err = new PolicyAllowlistError(
        'Mint is not allowed',
        {
          kind: 'mint',
          value: 'https://untrusted.mint',
          allowed: []
        },
        cause
      );
      expect(err.cause).toBe(cause);
    });

    it('serializes to JSON correctly', () => {
      const err = new PolicyAllowlistError('Mint is not allowed', {
        kind: 'mint',
        value: 'https://untrusted.mint',
        allowed: ['https://trusted.mint']
      });
      expect(err.toJSON()).toEqual({
        name: 'PolicyAllowlistError',
        code: 'POLICY_ALLOWLIST_VIOLATION',
        message: 'Mint is not allowed',
        context: {
          kind: 'mint',
          value: 'https://untrusted.mint',
          allowed: ['https://trusted.mint']
        }
      });
    });
  });

  describe('PolicyInputError', () => {
    it('initializes with code, message, and context', () => {
      const err = new PolicyInputError('Invalid policy input', {
        field: 'dailyBudgetSats',
        reason: 'Value cannot be negative'
      });
      expect(err).toBeInstanceOf(ValidationError);
      expect(err).toBeInstanceOf(KeplerError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('POLICY_INPUT_ERROR');
      expect(err.message).toBe('Invalid policy input');
      expect(err.context).toEqual({
        field: 'dailyBudgetSats',
        reason: 'Value cannot be negative'
      });
      expect(err.name).toBe('PolicyInputError');
    });

    it('attaches optional cause', () => {
      const cause = new Error('Zod validation failure');
      const err = new PolicyInputError(
        'Invalid policy input',
        { field: 'scopes', reason: 'Must contain at least one scope' },
        cause
      );
      expect(err.cause).toBe(cause);
    });

    it('serializes to JSON correctly', () => {
      const err = new PolicyInputError('Invalid policy input', {
        field: 'perTxBudgetSats',
        reason: 'Cannot exceed daily budget'
      });
      expect(err.toJSON()).toEqual({
        name: 'PolicyInputError',
        code: 'POLICY_INPUT_ERROR',
        message: 'Invalid policy input',
        context: {
          field: 'perTxBudgetSats',
          reason: 'Cannot exceed daily budget'
        }
      });
    });
  });

  describe('HTTP Status Code Mapping', () => {
    let app: Express;

    beforeEach(() => {
      app = express();
      app.use(express.json());

      app.get('/test-not-found', (_req: Request, _res: Response, next: NextFunction) => {
        next(new PolicyNotFoundError('Policy not found', { id: 'default' }));
      });

      app.get('/test-scope', (_req: Request, _res: Response, next: NextFunction) => {
        next(
          new PolicyScopeError('Scope violation', {
            scope: PolicyScope.Send,
            operation: 'send'
          })
        );
      });

      app.get('/test-budget', (_req: Request, _res: Response, next: NextFunction) => {
        next(
          new PolicyBudgetError('Daily budget exceeded', {
            limitType: 'daily',
            limitSats: '100000',
            spentSats: '90000',
            requestedSats: '20000'
          })
        );
      });

      app.get('/test-allowlist', (_req: Request, _res: Response, next: NextFunction) => {
        next(
          new PolicyAllowlistError('Mint not allowed', {
            kind: 'mint',
            value: 'https://evil.mint',
            allowed: ['https://good.mint']
          })
        );
      });

      app.get('/test-input', (_req: Request, _res: Response, next: NextFunction) => {
        next(
          new PolicyInputError('Invalid input', {
            field: 'dailyBudgetSats',
            reason: 'Negative value'
          })
        );
      });

      app.use(errorMiddleware);
    });

    it('maps PolicyNotFoundError to HTTP 404', async () => {
      const response = await request(app).get('/test-not-found');
      expect(response.status).toBe(404);
      expect(response.body.error).toEqual({
        code: 'POLICY_NOT_FOUND',
        message: 'Policy not found',
        context: { id: 'default' }
      });
    });

    it('maps PolicyScopeError to HTTP 403', async () => {
      const response = await request(app).get('/test-scope');
      expect(response.status).toBe(403);
      expect(response.body.error).toEqual({
        code: 'POLICY_SCOPE_VIOLATION',
        message: 'Scope violation',
        context: {
          scope: 'Send',
          operation: 'send'
        }
      });
    });

    it('maps PolicyBudgetError to HTTP 403', async () => {
      const response = await request(app).get('/test-budget');
      expect(response.status).toBe(403);
      expect(response.body.error).toEqual({
        code: 'POLICY_BUDGET_VIOLATION',
        message: 'Daily budget exceeded',
        context: {
          limitType: 'daily',
          limitSats: '100000',
          spentSats: '90000',
          requestedSats: '20000'
        }
      });
    });

    it('maps PolicyAllowlistError to HTTP 403', async () => {
      const response = await request(app).get('/test-allowlist');
      expect(response.status).toBe(403);
      expect(response.body.error).toEqual({
        code: 'POLICY_ALLOWLIST_VIOLATION',
        message: 'Mint not allowed',
        context: {
          kind: 'mint',
          value: 'https://evil.mint',
          allowed: ['https://good.mint']
        }
      });
    });

    it('maps PolicyInputError to HTTP 400', async () => {
      const response = await request(app).get('/test-input');
      expect(response.status).toBe(400);
      expect(response.body.error).toEqual({
        code: 'POLICY_INPUT_ERROR',
        message: 'Invalid input',
        context: {
          field: 'dailyBudgetSats',
          reason: 'Negative value'
        }
      });
    });
  });

  describe('Policy Types Contract', () => {
    it('validates CheckRequest discriminated union variants', () => {
      const readCheck: CheckRequest = { kind: 'read' };
      const proposeCheck: CheckRequest = { kind: 'propose' };
      const sendCheck: CheckRequest = {
        kind: 'send',
        amountSats: '5000',
        protocol: 'Bitcoin'
      };
      const publishCheck: CheckRequest = { kind: 'publish' };

      expect(readCheck.kind).toBe('read');
      expect(proposeCheck.kind).toBe('propose');
      expect(sendCheck.kind).toBe('send');
      expect(publishCheck.kind).toBe('publish');
    });

    it('validates CheckResponse shape', () => {
      const response: CheckResponse = {
        allowed: true,
        limits: {
          dailyRemainingSats: '10000',
          perTxLimitSats: '5000'
        }
      };
      expect(response.allowed).toBe(true);
      expect(response.limits.dailyRemainingSats).toBe('10000');
      expect(response.limits.perTxLimitSats).toBe('5000');
    });

    it('validates UpdatePolicyRequest shape', () => {
      const requestPayload: UpdatePolicyRequest = {
        dailyBudgetSats: '200000',
        perTxBudgetSats: '50000',
        scopes: [PolicyScope.Read, PolicyScope.Propose, PolicyScope.Send, PolicyScope.Publish],
        allowedMints: ['https://mint.example.com'],
        allowedRelays: ['wss://relay.example.com'],
        allowedEsplora: ['https://mempool.space/api']
      };
      expect(requestPayload.dailyBudgetSats).toBe('200000');
      expect(requestPayload.scopes).toHaveLength(4);
    });

    it('validates PolicyResponse shape', () => {
      const response: PolicyResponse = {
        id: 'default',
        dailyBudgetSats: '200000',
        perTxBudgetSats: '50000',
        scopes: [PolicyScope.Read, PolicyScope.Send],
        allowedMints: ['https://mint.example.com'],
        allowedRelays: ['wss://relay.example.com'],
        allowedEsplora: ['https://mempool.space/api'],
        updatedAt: '2026-09-30T12:00:00.000Z'
      };
      expect(response.id).toBe('default');
      expect(response.dailyBudgetSats).toBe('200000');
      expect(response.perTxBudgetSats).toBe('50000');
    });
  });
});
