import {
  NostrEvent,
  NostrFilter,
  VerifiedNostrEvent,
  PublishResult,
  KeplerDecisionPayload,
  NostrEventSchema,
  NostrWireEventSchema,
  NostrFilterSchema,
  KeplerDecisionPayloadSchema
} from '../../src';

describe('Nostr Types and Schemas', () => {
  const sampleEvent: NostrEvent = {
    id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    pubkey: '4646ae5047316b4230d0086c8acec687f00b1cd9d1dc634f6cb358ac0a9a8fff',
    createdAt: 1700000000,
    kind: 30078,
    tags: [
      ['d', 'scenario_123'],
      ['kepler', 'decision'],
      ['scenario', 'scenario_123'],
      ['evidence', 'hash_deadbeef'],
      ['decision', 'allow'],
      ['protocol', 'bitcoin']
    ],
    content: JSON.stringify({ summary: 'Approved transaction' }),
    sig: 'sig_deadbeef_123456789'
  };

  describe('NostrEvent interface', () => {
    it('instantiates valid NostrEvent with expected properties', () => {
      expect(sampleEvent.id).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');
      expect(sampleEvent.pubkey).toBe('4646ae5047316b4230d0086c8acec687f00b1cd9d1dc634f6cb358ac0a9a8fff');
      expect(sampleEvent.createdAt).toBe(1700000000);
      expect(sampleEvent.kind).toBe(30078);
      expect(sampleEvent.tags).toHaveLength(6);
      expect(sampleEvent.content).toContain('Approved transaction');
      expect(sampleEvent.sig).toBe('sig_deadbeef_123456789');
    });
  });

  describe('NostrFilter interface', () => {
    it('instantiates valid NostrFilter with all optional fields', () => {
      const filter: NostrFilter = {
        ids: ['id1', 'id2'],
        authors: ['author1'],
        kinds: [1, 30078],
        since: 1699990000,
        until: 1700010000,
        limit: 50,
        '#e': ['event1'],
        '#p': ['pubkey1'],
        '#d': ['scenario_123']
      };

      expect(filter.ids).toEqual(['id1', 'id2']);
      expect(filter.authors).toEqual(['author1']);
      expect(filter.kinds).toEqual([1, 30078]);
      expect(filter.since).toBe(1699990000);
      expect(filter.until).toBe(1700010000);
      expect(filter.limit).toBe(50);
      expect(filter['#e']).toEqual(['event1']);
      expect(filter['#p']).toEqual(['pubkey1']);
      expect(filter['#d']).toEqual(['scenario_123']);
    });

    it('instantiates empty NostrFilter', () => {
      const emptyFilter: NostrFilter = {};
      expect(emptyFilter.ids).toBeUndefined();
      expect(emptyFilter.kinds).toBeUndefined();
    });
  });

  describe('VerifiedNostrEvent interface', () => {
    it('instantiates VerifiedNostrEvent with verified boolean true', () => {
      const verifiedEvent: VerifiedNostrEvent = {
        event: sampleEvent,
        verified: true
      };

      expect(verifiedEvent.event).toEqual(sampleEvent);
      expect(verifiedEvent.verified).toBe(true);
    });
  });

  describe('PublishResult interface', () => {
    it('instantiates PublishResult with accepted and rejected relays', () => {
      const result: PublishResult = {
        event: sampleEvent,
        acceptedBy: ['wss://relay.damus.io'],
        rejectedBy: [
          { relay: 'wss://nos.lol', reason: 'blocked: rate limited' }
        ]
      };

      expect(result.event).toEqual(sampleEvent);
      expect(result.acceptedBy).toEqual(['wss://relay.damus.io']);
      expect(result.rejectedBy).toHaveLength(1);
      expect(result.rejectedBy[0]?.relay).toBe('wss://nos.lol');
      expect(result.rejectedBy[0]?.reason).toBe('blocked: rate limited');
    });
  });

  describe('KeplerDecisionPayload interface', () => {
    it('instantiates KeplerDecisionPayload with required fields', () => {
      const payload: KeplerDecisionPayload = {
        scenarioId: 'scenario_abc',
        decision: 'allow',
        protocol: 'lightning',
        evidenceHash: 'sha256_hash_123',
        summary: 'Taint score 0 within threshold'
      };

      expect(payload.scenarioId).toBe('scenario_abc');
      expect(payload.decision).toBe('allow');
      expect(payload.protocol).toBe('lightning');
      expect(payload.evidenceHash).toBe('sha256_hash_123');
      expect(payload.summary).toBe('Taint score 0 within threshold');
    });
  });

  describe('NostrEventSchema', () => {
    it('validates a correct NostrEvent', () => {
      const result = NostrEventSchema.safeParse(sampleEvent);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(sampleEvent.id);
        expect(result.data.createdAt).toBe(1700000000);
      }
    });

    it('rejects an event with missing id', () => {
      const invalid = { ...sampleEvent, id: '' };
      const result = NostrEventSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects an event with negative createdAt', () => {
      const invalid = { ...sampleEvent, createdAt: -1 };
      const result = NostrEventSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects an event with negative kind', () => {
      const invalid = { ...sampleEvent, kind: -5 };
      const result = NostrEventSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects an event with malformed tags', () => {
      const invalid = { ...sampleEvent, tags: 'not-an-array' };
      const result = NostrEventSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('NostrWireEventSchema', () => {
    it('validates a wire event with snake_case created_at', () => {
      const wireEvent = {
        id: sampleEvent.id,
        pubkey: sampleEvent.pubkey,
        created_at: 1700000000,
        kind: sampleEvent.kind,
        tags: sampleEvent.tags,
        content: sampleEvent.content,
        sig: sampleEvent.sig
      };

      const result = NostrWireEventSchema.safeParse(wireEvent);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.created_at).toBe(1700000000);
      }
    });

    it('rejects a wire event missing created_at', () => {
      const invalid = {
        id: sampleEvent.id,
        pubkey: sampleEvent.pubkey,
        kind: sampleEvent.kind,
        tags: sampleEvent.tags,
        content: sampleEvent.content,
        sig: sampleEvent.sig
      };

      const result = NostrWireEventSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('NostrFilterSchema', () => {
    it('validates a filter with all supported query fields', () => {
      const filter = {
        ids: ['abc', 'def'],
        authors: ['pk1'],
        kinds: [1, 30078],
        since: 1000,
        until: 2000,
        limit: 10,
        '#e': ['event1'],
        '#p': ['pubkey1'],
        '#d': ['scenario_1']
      };

      const result = NostrFilterSchema.safeParse(filter);
      expect(result.success).toBe(true);
    });

    it('validates an empty filter', () => {
      const result = NostrFilterSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects a filter with negative since', () => {
      const result = NostrFilterSchema.safeParse({ since: -100 });
      expect(result.success).toBe(false);
    });

    it('rejects a filter with non-integer kind', () => {
      const result = NostrFilterSchema.safeParse({ kinds: [1.5] });
      expect(result.success).toBe(false);
    });
  });

  describe('KeplerDecisionPayloadSchema', () => {
    it('validates a valid decision payload', () => {
      const payload = {
        scenarioId: 'sc_1',
        decision: 'reject',
        protocol: 'bitcoin',
        evidenceHash: 'hash_456',
        summary: 'Direct taint detected'
      };

      const result = KeplerDecisionPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects a payload with missing required fields', () => {
      const invalid = {
        scenarioId: '',
        decision: 'allow'
      };

      const result = KeplerDecisionPayloadSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
