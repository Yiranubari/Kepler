export const NostrKind = Object.freeze({
  Metadata: 0,
  TextNote: 1,
  ContactList: 3,
  EncryptedDirectMessage: 4,
  Deletion: 5,
  Reaction: 7,
  ZapReceipt: 9735,
  AppSpecificData: 30078
} as const);

export type NostrKind = typeof NostrKind[keyof typeof NostrKind];

export const KeplerTag = Object.freeze({
  Kepler: 'kepler',
  Scenario: 'scenario',
  EvidenceHash: 'evidence',
  Decision: 'decision',
  Protocol: 'protocol'
} as const);

export type KeplerTag = typeof KeplerTag[keyof typeof KeplerTag];
