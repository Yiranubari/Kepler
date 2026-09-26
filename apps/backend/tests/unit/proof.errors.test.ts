import { KeplerError } from '@kepler/shared';
import {
  ProofBuildError,
  ProofVerificationError,
  ProofPersistenceError,
  ProofNotFoundError,
  ProofUnsupportedClaimError
} from '../../src/modules/proof/proof.errors';

describe('ProofError hierarchy', () => {
  describe('ProofBuildError', () => {
    it('sets code and context correctly', () => {
      const err = new ProofBuildError('Failed to build proof', {
        claimType: 'Transaction',
        reason: 'Missing input data'
      });
      expect(err).toBeInstanceOf(KeplerError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('PROOF_BUILD_ERROR');
      expect(err.message).toBe('Failed to build proof');
      expect(err.context).toEqual({
        claimType: 'Transaction',
        reason: 'Missing input data'
      });
    });

    it('passes cause when provided', () => {
      const cause = new Error('Root cause');
      const err = new ProofBuildError(
        'Failed to build proof',
        { claimType: 'Transaction', reason: 'Root cause' },
        cause
      );
      expect(err.cause).toBe(cause);
    });

    it('serializes to JSON properly', () => {
      const err = new ProofBuildError('Failed to build proof', {
        claimType: 'Transaction',
        reason: 'Missing input data'
      });
      const json = err.toJSON();
      expect(json).toEqual({
        name: 'ProofBuildError',
        code: 'PROOF_BUILD_ERROR',
        message: 'Failed to build proof',
        context: {
          claimType: 'Transaction',
          reason: 'Missing input data'
        }
      });
    });
  });

  describe('ProofVerificationError', () => {
    it('sets code and context correctly', () => {
      const err = new ProofVerificationError('Verification failed', {
        bundleId: 'bundle-1',
        step: 'step-1',
        reason: 'Hash mismatch'
      });
      expect(err).toBeInstanceOf(KeplerError);
      expect(err.code).toBe('PROOF_VERIFICATION_ERROR');
      expect(err.context).toEqual({
        bundleId: 'bundle-1',
        step: 'step-1',
        reason: 'Hash mismatch'
      });
    });

    it('passes cause when provided', () => {
      const cause = new Error('Network timeout');
      const err = new ProofVerificationError(
        'Verification failed',
        { bundleId: 'bundle-1', step: 'step-1', reason: 'Network timeout' },
        cause
      );
      expect(err.cause).toBe(cause);
    });
  });

  describe('ProofPersistenceError', () => {
    it('sets code and context correctly', () => {
      const err = new ProofPersistenceError('Failed to persist proof', {
        bundleId: 'bundle-1',
        operation: 'create',
        reason: 'Database connection failed'
      });
      expect(err).toBeInstanceOf(KeplerError);
      expect(err.code).toBe('PROOF_PERSISTENCE_ERROR');
      expect(err.context).toEqual({
        bundleId: 'bundle-1',
        operation: 'create',
        reason: 'Database connection failed'
      });
    });

    it('passes cause when provided', () => {
      const cause = new Error('Connection refused');
      const err = new ProofPersistenceError(
        'Failed to persist proof',
        { bundleId: 'bundle-1', operation: 'create', reason: 'Connection refused' },
        cause
      );
      expect(err.cause).toBe(cause);
    });
  });

  describe('ProofNotFoundError', () => {
    it('sets code and context correctly', () => {
      const err = new ProofNotFoundError('Proof bundle not found', {
        bundleHash: '0x123abc'
      });
      expect(err).toBeInstanceOf(KeplerError);
      expect(err.code).toBe('PROOF_NOT_FOUND');
      expect(err.context).toEqual({
        bundleHash: '0x123abc'
      });
    });

    it('passes cause when provided', () => {
      const cause = new Error('Record not found');
      const err = new ProofNotFoundError(
        'Proof bundle not found',
        { bundleHash: '0x123abc' },
        cause
      );
      expect(err.cause).toBe(cause);
    });
  });

  describe('ProofUnsupportedClaimError', () => {
    it('sets code and context correctly', () => {
      const err = new ProofUnsupportedClaimError('Claim type unsupported', {
        claimType: 'CustomType'
      });
      expect(err).toBeInstanceOf(KeplerError);
      expect(err.code).toBe('PROOF_UNSUPPORTED_CLAIM');
      expect(err.context).toEqual({
        claimType: 'CustomType'
      });
    });

    it('passes cause when provided', () => {
      const cause = new Error('Not implemented');
      const err = new ProofUnsupportedClaimError(
        'Claim type unsupported',
        { claimType: 'CustomType' },
        cause
      );
      expect(err.cause).toBe(cause);
    });
  });
});
