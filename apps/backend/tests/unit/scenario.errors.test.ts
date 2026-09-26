import { KeplerError, NotFoundError } from '@kepler/shared';
import {
  ScenarioNotFoundError,
  ScenarioStateError
} from '../../src/modules/scenario/scenario.errors';

describe('ScenarioError hierarchy', () => {
  describe('ScenarioNotFoundError', () => {
    it('sets code and context correctly', () => {
      const err = new ScenarioNotFoundError('Scenario not found', {
        id: 'scenario-123'
      });
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err).toBeInstanceOf(KeplerError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('SCENARIO_NOT_FOUND');
      expect(err.message).toBe('Scenario not found');
      expect(err.context).toEqual({
        id: 'scenario-123'
      });
    });

    it('passes cause when provided', () => {
      const cause = new Error('Database lookup failed');
      const err = new ScenarioNotFoundError(
        'Scenario not found',
        { id: 'scenario-123' },
        cause
      );
      expect(err.cause).toBe(cause);
    });

    it('serializes to JSON properly', () => {
      const err = new ScenarioNotFoundError('Scenario not found', {
        id: 'scenario-123'
      });
      const json = err.toJSON();
      expect(json).toEqual({
        name: 'ScenarioNotFoundError',
        code: 'SCENARIO_NOT_FOUND',
        message: 'Scenario not found',
        context: {
          id: 'scenario-123'
        }
      });
    });
  });

  describe('ScenarioStateError', () => {
    it('sets code and context correctly', () => {
      const err = new ScenarioStateError('Invalid state transition', {
        id: 'scenario-456',
        currentStatus: 'Pending',
        attemptedTransition: 'Executed'
      });
      expect(err).toBeInstanceOf(KeplerError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('SCENARIO_STATE_ERROR');
      expect(err.message).toBe('Invalid state transition');
      expect(err.context).toEqual({
        id: 'scenario-456',
        currentStatus: 'Pending',
        attemptedTransition: 'Executed'
      });
    });

    it('passes cause when provided', () => {
      const cause = new Error('State validation failed');
      const err = new ScenarioStateError(
        'Invalid state transition',
        {
          id: 'scenario-456',
          currentStatus: 'Pending',
          attemptedTransition: 'Executed'
        },
        cause
      );
      expect(err.cause).toBe(cause);
    });

    it('serializes to JSON properly', () => {
      const err = new ScenarioStateError('Invalid state transition', {
        id: 'scenario-456',
        currentStatus: 'Pending',
        attemptedTransition: 'Executed'
      });
      const json = err.toJSON();
      expect(json).toEqual({
        name: 'ScenarioStateError',
        code: 'SCENARIO_STATE_ERROR',
        message: 'Invalid state transition',
        context: {
          id: 'scenario-456',
          currentStatus: 'Pending',
          attemptedTransition: 'Executed'
        }
      });
    });
  });
});
