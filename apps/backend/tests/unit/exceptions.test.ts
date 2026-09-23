import {
  KeplerError,
  ConfigurationError,
  ValidationError,
  NotFoundError,
  NetworkError,
  RateLimitError,
  PolicyError,
  TaintError,
  ProofError,
  AIError,
  ProtocolError,
  InternalError
} from '@kepler/shared';

describe('Exception hierarchy', () => {
  const subclasses: Array<{
    name: string;
    factory: () => KeplerError;
    expectedCode: string;
  }> = [
    {
      name: 'ConfigurationError',
      factory: () => new ConfigurationError('test'),
      expectedCode: 'CONFIGURATION_ERROR'
    },
    {
      name: 'ValidationError',
      factory: () => new ValidationError('test'),
      expectedCode: 'VALIDATION_ERROR'
    },
    {
      name: 'NotFoundError',
      factory: () => new NotFoundError('test'),
      expectedCode: 'NOT_FOUND'
    },
    {
      name: 'NetworkError',
      factory: () => new NetworkError('test'),
      expectedCode: 'NETWORK_ERROR'
    },
    {
      name: 'RateLimitError',
      factory: () => new RateLimitError('test'),
      expectedCode: 'RATE_LIMIT_EXCEEDED'
    },
    {
      name: 'PolicyError',
      factory: () => new PolicyError('test'),
      expectedCode: 'POLICY_VIOLATION'
    },
    {
      name: 'TaintError',
      factory: () => new TaintError('test'),
      expectedCode: 'TAINT_ERROR'
    },
    {
      name: 'ProofError',
      factory: () => new ProofError('test'),
      expectedCode: 'PROOF_ERROR'
    },
    {
      name: 'AIError',
      factory: () => new AIError('test'),
      expectedCode: 'AI_ERROR'
    },
    {
      name: 'InternalError',
      factory: () => new InternalError('test'),
      expectedCode: 'INTERNAL_ERROR'
    }
  ];

  describe.each(subclasses)('$name', ({ factory, expectedCode }) => {
    it('has the correct default code', () => {
      const err = factory();
      expect(err.code).toBe(expectedCode);
    });

    it('is instanceof KeplerError', () => {
      const err = factory();
      expect(err).toBeInstanceOf(KeplerError);
    });

    it('is instanceof Error', () => {
      const err = factory();
      expect(err).toBeInstanceOf(Error);
    });

    it('toJSON returns expected shape', () => {
      const err = factory();
      const json = err.toJSON();
      expect(json).toHaveProperty('name', err.name);
      expect(json).toHaveProperty('code', expectedCode);
      expect(json).toHaveProperty('message', 'test');
      expect(json).toHaveProperty('context');
      expect(typeof json.context).toBe('object');
    });

    it('context defaults to empty object when not provided', () => {
      const err = factory();
      expect(err.context).toEqual({});
    });

    it('cause is passed through when provided', () => {
      const cause = new Error('root cause');
      const err = new (factory().constructor as new (msg: string, ctx: Record<string, unknown>, cause?: Error) => KeplerError)('test', {}, cause);
      expect(err.cause).toBe(cause);
    });
  });

  it('ProtocolError cannot be instantiated directly', () => {
    expect(() => {
      class ConcreteProtocol extends ProtocolError {
        public readonly code = 'PROTOCOL_ERROR';
      }
      new ConcreteProtocol('test');
    }).not.toThrow();

    expect(ProtocolError.prototype).toBeDefined();

    const isAbstractClass = (() => {
      try {
        new (ProtocolError as unknown as new () => ProtocolError)();
        return false;
      } catch {
        return true;
      }
    })();
    expect(isAbstractClass).toBe(true);
  });

  it('context carries provided key-value pairs', () => {
    const err = new ValidationError('bad field', { field: 'name', receivedValue: '' });
    expect(err.context).toEqual({ field: 'name', receivedValue: '' });
    expect(err.toJSON().context).toEqual({ field: 'name', receivedValue: '' });
  });

  it('err.name equals constructor name', () => {
    const err = new ConfigurationError('env missing');
    expect(err.name).toBe('ConfigurationError');
  });
});
