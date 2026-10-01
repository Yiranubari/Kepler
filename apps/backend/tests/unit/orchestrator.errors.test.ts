import express, { Express, Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { KeplerError, NotFoundError } from '@kepler/shared';
import {
  OrchestratorNotFoundError,
  OrchestratorStateError,
  OrchestratorRouteError,
  OrchestratorExecutionError,
  OrchestratorNoRouteError
} from '../../src/modules/orchestrator/orchestrator.errors';
import { errorMiddleware } from '../../src/middleware/error';

describe('OrchestratorError hierarchy', () => {
  describe('OrchestratorNotFoundError', () => {
    it('sets code and context correctly', () => {
      const err = new OrchestratorNotFoundError('Scenario not found', {
        resource: 'Scenario',
        id: 'scenario-1'
      });
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err).toBeInstanceOf(KeplerError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('ORCHESTRATOR_NOT_FOUND');
      expect(err.message).toBe('Scenario not found');
      expect(err.context).toEqual({
        resource: 'Scenario',
        id: 'scenario-1'
      });
    });

    it('passes cause when provided', () => {
      const cause = new Error('Database error');
      const err = new OrchestratorNotFoundError(
        'Scenario not found',
        { resource: 'Scenario', id: 'scenario-1' },
        cause
      );
      expect(err.cause).toBe(cause);
    });

    it('serializes to JSON properly', () => {
      const err = new OrchestratorNotFoundError('Scenario not found', {
        resource: 'Scenario',
        id: 'scenario-1'
      });
      const json = err.toJSON();
      expect(json).toEqual({
        name: 'OrchestratorNotFoundError',
        code: 'ORCHESTRATOR_NOT_FOUND',
        message: 'Scenario not found',
        context: {
          resource: 'Scenario',
          id: 'scenario-1'
        }
      });
    });
  });

  describe('OrchestratorStateError', () => {
    it('sets code and context correctly', () => {
      const err = new OrchestratorStateError('Scenario state invalid', {
        scenarioId: 'scenario-2',
        currentStatus: 'Executed',
        expectedStatus: 'Pending'
      });
      expect(err).toBeInstanceOf(KeplerError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('ORCHESTRATOR_STATE_ERROR');
      expect(err.message).toBe('Scenario state invalid');
      expect(err.context).toEqual({
        scenarioId: 'scenario-2',
        currentStatus: 'Executed',
        expectedStatus: 'Pending'
      });
    });

    it('passes cause when provided', () => {
      const cause = new Error('Invalid transition');
      const err = new OrchestratorStateError(
        'Scenario state invalid',
        {
          scenarioId: 'scenario-2',
          currentStatus: 'Executed',
          expectedStatus: 'Pending'
        },
        cause
      );
      expect(err.cause).toBe(cause);
    });

    it('serializes to JSON properly', () => {
      const err = new OrchestratorStateError('Scenario state invalid', {
        scenarioId: 'scenario-2',
        currentStatus: 'Executed',
        expectedStatus: 'Pending'
      });
      const json = err.toJSON();
      expect(json).toEqual({
        name: 'OrchestratorStateError',
        code: 'ORCHESTRATOR_STATE_ERROR',
        message: 'Scenario state invalid',
        context: {
          scenarioId: 'scenario-2',
          currentStatus: 'Executed',
          expectedStatus: 'Pending'
        }
      });
    });
  });

  describe('OrchestratorRouteError', () => {
    it('sets code and context correctly', () => {
      const err = new OrchestratorRouteError('Route selection failed', {
        scenarioId: 'scenario-3',
        reason: 'No viable candidates'
      });
      expect(err).toBeInstanceOf(KeplerError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('ORCHESTRATOR_ROUTE_ERROR');
      expect(err.message).toBe('Route selection failed');
      expect(err.context).toEqual({
        scenarioId: 'scenario-3',
        reason: 'No viable candidates'
      });
    });

    it('passes cause when provided', () => {
      const cause = new Error('Graph traversal error');
      const err = new OrchestratorRouteError(
        'Route selection failed',
        { scenarioId: 'scenario-3', reason: 'Graph traversal error' },
        cause
      );
      expect(err.cause).toBe(cause);
    });

    it('serializes to JSON properly', () => {
      const err = new OrchestratorRouteError('Route selection failed', {
        scenarioId: 'scenario-3',
        reason: 'No viable candidates'
      });
      const json = err.toJSON();
      expect(json).toEqual({
        name: 'OrchestratorRouteError',
        code: 'ORCHESTRATOR_ROUTE_ERROR',
        message: 'Route selection failed',
        context: {
          scenarioId: 'scenario-3',
          reason: 'No viable candidates'
        }
      });
    });
  });

  describe('OrchestratorExecutionError', () => {
    it('sets code and context correctly', () => {
      const err = new OrchestratorExecutionError('Execution dispatch failed', {
        scenarioId: 'scenario-4',
        protocol: 'lightning',
        reason: 'Invoice payment failed'
      });
      expect(err).toBeInstanceOf(KeplerError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('ORCHESTRATOR_EXECUTION_ERROR');
      expect(err.message).toBe('Execution dispatch failed');
      expect(err.context).toEqual({
        scenarioId: 'scenario-4',
        protocol: 'lightning',
        reason: 'Invoice payment failed'
      });
    });

    it('passes cause when provided', () => {
      const cause = new Error('Connection refused');
      const err = new OrchestratorExecutionError(
        'Execution dispatch failed',
        {
          scenarioId: 'scenario-4',
          protocol: 'lightning',
          reason: 'Connection refused'
        },
        cause
      );
      expect(err.cause).toBe(cause);
    });

    it('serializes to JSON properly', () => {
      const err = new OrchestratorExecutionError('Execution dispatch failed', {
        scenarioId: 'scenario-4',
        protocol: 'lightning',
        reason: 'Invoice payment failed'
      });
      const json = err.toJSON();
      expect(json).toEqual({
        name: 'OrchestratorExecutionError',
        code: 'ORCHESTRATOR_EXECUTION_ERROR',
        message: 'Execution dispatch failed',
        context: {
          scenarioId: 'scenario-4',
          protocol: 'lightning',
          reason: 'Invoice payment failed'
        }
      });
    });
  });

  describe('OrchestratorNoRouteError', () => {
    it('sets code and context correctly', () => {
      const err = new OrchestratorNoRouteError('No route available', {
        scenarioId: 'scenario-5',
        candidateCount: 0
      });
      expect(err).toBeInstanceOf(KeplerError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('ORCHESTRATOR_NO_ROUTE');
      expect(err.message).toBe('No route available');
      expect(err.context).toEqual({
        scenarioId: 'scenario-5',
        candidateCount: 0
      });
    });

    it('passes cause when provided', () => {
      const cause = new Error('Empty routes');
      const err = new OrchestratorNoRouteError(
        'No route available',
        { scenarioId: 'scenario-5', candidateCount: 0 },
        cause
      );
      expect(err.cause).toBe(cause);
    });

    it('serializes to JSON properly', () => {
      const err = new OrchestratorNoRouteError('No route available', {
        scenarioId: 'scenario-5',
        candidateCount: 0
      });
      const json = err.toJSON();
      expect(json).toEqual({
        name: 'OrchestratorNoRouteError',
        code: 'ORCHESTRATOR_NO_ROUTE',
        message: 'No route available',
        context: {
          scenarioId: 'scenario-5',
          candidateCount: 0
        }
      });
    });
  });

  describe('errorMiddleware HTTP status mapping', () => {
    let app: Express;

    beforeEach(() => {
      app = express();
      app.use(express.json());

      app.get('/not-found', (_req: Request, _res: Response, next: NextFunction) => {
        next(
          new OrchestratorNotFoundError('Scenario not found', {
            resource: 'Scenario',
            id: 'scenario-1'
          })
        );
      });

      app.get('/state-error', (_req: Request, _res: Response, next: NextFunction) => {
        next(
          new OrchestratorStateError('Invalid state', {
            scenarioId: 'scenario-2',
            currentStatus: 'Executed',
            expectedStatus: 'Pending'
          })
        );
      });

      app.get('/route-error', (_req: Request, _res: Response, next: NextFunction) => {
        next(
          new OrchestratorRouteError('Route selection failed', {
            scenarioId: 'scenario-3',
            reason: 'Taint threshold exceeded'
          })
        );
      });

      app.get('/execution-error', (_req: Request, _res: Response, next: NextFunction) => {
        next(
          new OrchestratorExecutionError('Payment failed', {
            scenarioId: 'scenario-4',
            protocol: 'cashu',
            reason: 'Melt failed'
          })
        );
      });

      app.get('/no-route-error', (_req: Request, _res: Response, next: NextFunction) => {
        next(
          new OrchestratorNoRouteError('No routes found', {
            scenarioId: 'scenario-5',
            candidateCount: 0
          })
        );
      });

      app.use(errorMiddleware);
    });

    it('maps OrchestratorNotFoundError to 404', async () => {
      const res = await request(app).get('/not-found');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ORCHESTRATOR_NOT_FOUND');
      expect(res.body.error.context).toEqual({
        resource: 'Scenario',
        id: 'scenario-1'
      });
    });

    it('maps OrchestratorStateError to 409', async () => {
      const res = await request(app).get('/state-error');
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ORCHESTRATOR_STATE_ERROR');
      expect(res.body.error.context).toEqual({
        scenarioId: 'scenario-2',
        currentStatus: 'Executed',
        expectedStatus: 'Pending'
      });
    });

    it('maps OrchestratorRouteError to 422', async () => {
      const res = await request(app).get('/route-error');
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('ORCHESTRATOR_ROUTE_ERROR');
      expect(res.body.error.context).toEqual({
        scenarioId: 'scenario-3',
        reason: 'Taint threshold exceeded'
      });
    });

    it('maps OrchestratorExecutionError to 502', async () => {
      const res = await request(app).get('/execution-error');
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('ORCHESTRATOR_EXECUTION_ERROR');
      expect(res.body.error.context).toEqual({
        scenarioId: 'scenario-4',
        protocol: 'cashu',
        reason: 'Melt failed'
      });
    });

    it('maps OrchestratorNoRouteError to 422', async () => {
      const res = await request(app).get('/no-route-error');
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('ORCHESTRATOR_NO_ROUTE');
      expect(res.body.error.context).toEqual({
        scenarioId: 'scenario-5',
        candidateCount: 0
      });
    });
  });
});
