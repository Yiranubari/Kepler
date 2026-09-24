import { NostrKind, KeplerTag } from '../../src';

describe('Nostr Kinds and Tags', () => {
  describe('NostrKind', () => {
    it('defines expected kind numbers', () => {
      expect(NostrKind.Metadata).toBe(0);
      expect(NostrKind.TextNote).toBe(1);
      expect(NostrKind.ContactList).toBe(3);
      expect(NostrKind.EncryptedDirectMessage).toBe(4);
      expect(NostrKind.Deletion).toBe(5);
      expect(NostrKind.Reaction).toBe(7);
      expect(NostrKind.ZapReceipt).toBe(9735);
      expect(NostrKind.AppSpecificData).toBe(30078);
    });

    it('is a frozen object', () => {
      expect(Object.isFrozen(NostrKind)).toBe(true);
      expect(() => {
        (NostrKind as Record<string, unknown>)['NewKind'] = 99999;
      }).toThrow();
    });
  });

  describe('KeplerTag', () => {
    it('defines expected tag names for decision events', () => {
      expect(KeplerTag.Kepler).toBe('kepler');
      expect(KeplerTag.Scenario).toBe('scenario');
      expect(KeplerTag.EvidenceHash).toBe('evidence');
      expect(KeplerTag.Decision).toBe('decision');
      expect(KeplerTag.Protocol).toBe('protocol');
    });

    it('is a frozen object', () => {
      expect(Object.isFrozen(KeplerTag)).toBe(true);
      expect(() => {
        (KeplerTag as Record<string, unknown>)['NewTag'] = 'test';
      }).toThrow();
    });
  });
});
