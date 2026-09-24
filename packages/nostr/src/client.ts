import { SimplePool, finalizeEvent, verifyEvent, nip19, type Filter } from 'nostr-tools';
import type { KeplerLogger } from '@kepler/shared';
import { NostrConfig } from './config';
import { NostrKind } from './kinds';
import {
  NostrConnectionError,
  NostrTimeoutError,
  NostrPublishError,
  NostrParseError
} from './errors';
import {
  NostrEvent,
  NostrFilter,
  VerifiedNostrEvent,
  PublishResult,
  PublishRejectedRelay,
  KeplerDecisionPayload,
  NostrWireEventSchema
} from './types';

type SubCloser = {
  close: (reason?: string) => void;
};

export class NostrClient {
  private readonly _config: NostrConfig;
  private readonly _logger: KeplerLogger;
  private readonly _pool: SimplePool;
  private readonly _secretBytes: Uint8Array;
  private _connected: boolean = false;
  private _connectedRelays: string[] = [];

  constructor(config: NostrConfig, logger: KeplerLogger, pool?: SimplePool) {
    this._config = config;
    this._logger = logger;
    this._pool = pool ?? new SimplePool();
    this._secretBytes = Uint8Array.from(Buffer.from(this._config.privateKey, 'hex'));
  }

  public get config(): NostrConfig {
    return this._config;
  }

  public get isConnected(): boolean {
    return this._connected;
  }

  public get connectedRelays(): string[] {
    return [...this._connectedRelays];
  }

  public async connect(): Promise<void> {
    if (this._connected) {
      return;
    }

    let timer: NodeJS.Timeout | undefined;
    try {
      const connectionTask = Promise.allSettled(
        this._config.relays.map(async (relayUrl) => {
          try {
            await this._pool.ensureRelay(relayUrl, {
              connectionTimeout: this._config.timeoutMs
            });
            return relayUrl;
          } catch (err: unknown) {
            const reason = err instanceof Error ? err.message : String(err);
            this._logger.warn(`Failed to connect to relay: ${relayUrl}`, {
              relay: relayUrl,
              reason
            });
            throw new Error(reason);
          }
        })
      );

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new NostrTimeoutError('Connection timed out', {
            timeoutMs: this._config.timeoutMs
          }));
        }, this._config.timeoutMs);
      });

      const settled = await Promise.race([connectionTask, timeoutPromise]);

      const connectedRelays: string[] = [];
      const errors: Record<string, string> = {};

      for (let i = 0; i < this._config.relays.length; i++) {
        const relayUrl = this._config.relays[i];
        if (!relayUrl) {
          continue;
        }
        const res = settled[i];
        if (res?.status === 'fulfilled') {
          connectedRelays.push(relayUrl);
        } else {
          const reason = res?.status === 'rejected'
            ? (res.reason instanceof Error ? res.reason.message : String(res.reason))
            : 'Connection failed';
          errors[relayUrl] = reason;
        }
      }

      if (connectedRelays.length === 0) {
        throw new NostrConnectionError('Failed to connect to any relay', {
          relays: [...this._config.relays],
          errors
        });
      }

      this._connected = true;
      this._connectedRelays = connectedRelays;
      this._logger.info('Connected to Nostr relays', {
        connectedRelays: connectedRelays.length,
        totalRelays: this._config.relays.length
      });
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (!this._connected && this._connectedRelays.length === 0) {
      return;
    }
    try {
      this._pool.close(this._config.relays);
    } catch {
    }
    this._connected = false;
    this._connectedRelays = [];
  }

  public async publish(event: Omit<NostrEvent, 'id' | 'sig'>): Promise<PublishResult> {
    if (!this._connected) {
      throw new NostrConnectionError('Client is not connected. Call connect() first.', {
        relays: [...this._config.relays]
      });
    }

    const relays = this._connectedRelays.length > 0 ? this._connectedRelays : this._config.relays;
    const createdAt = event.createdAt ?? Math.floor(Date.now() / 1000);
    const template = {
      kind: event.kind,
      created_at: createdAt,
      tags: event.tags,
      content: event.content
    };

    const signed = finalizeEvent(template, this._secretBytes);

    const signedNostrEvent: NostrEvent = {
      id: signed.id,
      pubkey: this._config.publicKey,
      createdAt: signed.created_at,
      kind: signed.kind,
      tags: signed.tags,
      content: signed.content,
      sig: signed.sig
    };

    const pubs = this._pool.publish(relays, signed, { maxWait: this._config.publishTimeoutMs });

    const publishResults = await Promise.all(
      relays.map(async (relayUrl, index) => {
        let timer: NodeJS.Timeout | undefined;
        try {
          const pubPromise = pubs[index] ?? Promise.reject(new Error('No publication promise for relay'));
          const timeoutPromise = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              reject(new Error('TIMEOUT'));
            }, this._config.publishTimeoutMs);
          });
          await Promise.race([pubPromise, timeoutPromise]);
          return { relay: relayUrl, accepted: true, reason: undefined };
        } catch (err: unknown) {
          const rawReason = err instanceof Error ? err.message : String(err);
          const reason = rawReason.includes('TIMEOUT') ? 'TIMEOUT' : rawReason;
          return { relay: relayUrl, accepted: false, reason };
        } finally {
          if (timer !== undefined) {
            clearTimeout(timer);
          }
        }
      })
    );

    const acceptedBy: string[] = [];
    const rejectedBy: PublishRejectedRelay[] = [];

    for (const res of publishResults) {
      if (res.accepted) {
        acceptedBy.push(res.relay);
      } else {
        rejectedBy.push({ relay: res.relay, reason: res.reason ?? 'UNKNOWN' });
      }
    }

    if (acceptedBy.length === 0) {
      throw new NostrPublishError('Event publication rejected by all relays', {
        eventId: signedNostrEvent.id,
        rejectedBy
      });
    }

    for (const rej of rejectedBy) {
      this._logger.warn(`Event publication rejected by relay: ${rej.relay}`, {
        relay: rej.relay,
        reason: rej.reason
      });
    }

    this._logger.info('Event published successfully', {
      eventId: signedNostrEvent.id,
      kind: signedNostrEvent.kind,
      acceptedCount: acceptedBy.length
    });

    return {
      event: signedNostrEvent,
      acceptedBy,
      rejectedBy
    };
  }

  public async publishDecision(payload: KeplerDecisionPayload): Promise<PublishResult> {
    const tags: string[][] = [
      ['d', payload.scenarioId],
      ['kepler', 'true'],
      ['decision', payload.decision],
      ['protocol', payload.protocol],
      ['evidence', payload.evidenceHash]
    ];

    return this.publish({
      pubkey: this._config.publicKey,
      createdAt: Math.floor(Date.now() / 1000),
      kind: NostrKind.AppSpecificData,
      tags,
      content: payload.summary
    });
  }

  public async fetchEvents(filters: NostrFilter[], timeoutMs?: number): Promise<VerifiedNostrEvent[]> {
    if (!this._connected) {
      throw new NostrConnectionError('Client is not connected. Call connect() first.', {
        relays: [...this._config.relays]
      });
    }

    if (filters.length === 0) {
      return [];
    }

    const effectiveTimeoutMs = timeoutMs ?? this._config.timeoutMs;
    const startTime = Date.now();
    const relays = this._connectedRelays.length > 0 ? this._connectedRelays : this._config.relays;

    return new Promise<VerifiedNostrEvent[]>((resolve, reject) => {
      const collectedEvents = new Map<string, VerifiedNostrEvent>();
      const eoseRelays = new Set<string>();
      const activeSubs: SubCloser[] = [];
      let isDone = false;
      let timer: NodeJS.Timeout | undefined;

      const cleanup = () => {
        if (timer !== undefined) {
          clearTimeout(timer);
          timer = undefined;
        }
        for (const sub of activeSubs) {
          try {
            sub.close();
          } catch {
          }
        }
        activeSubs.length = 0;
      };

      const finish = () => {
        if (isDone) {
          return;
        }
        isDone = true;
        cleanup();

        let resultEvents = Array.from(collectedEvents.values());
        if (resultEvents.length > this._config.subscriptionLimit) {
          this._logger.warn('Subscription limit exceeded, truncating results', {
            limit: this._config.subscriptionLimit
          });
          resultEvents = resultEvents.slice(0, this._config.subscriptionLimit);
        }

        this._logger.debug('Fetched Nostr events', {
          eventCount: resultEvents.length,
          durationMs: Date.now() - startTime,
          relayCount: relays.length
        });

        resolve(resultEvents);
      };

      timer = setTimeout(() => {
        if (isDone) {
          return;
        }
        if (collectedEvents.size === 0 && eoseRelays.size === 0 && relays.length > 0) {
          isDone = true;
          cleanup();
          reject(new NostrTimeoutError('Timed out fetching events from relays', {
            timeoutMs: effectiveTimeoutMs,
            relays
          }));
          return;
        }
        finish();
      }, effectiveTimeoutMs);

      for (const relayUrl of relays) {
        const requests = filters.map((filter) => ({ url: relayUrl, filter: filter as Filter }));
        const sub = this._pool.subscribeMap(requests, {
          onevent: (rawEvt: unknown) => {
            if (isDone) {
              return;
            }
            const parsed = NostrWireEventSchema.safeParse(rawEvt);
            if (!parsed.success) {
              this._logger.warn('Received invalid event wire payload from relay', {
                relay: relayUrl,
                error: parsed.error.message
              });
              return;
            }

            const wireEvent = parsed.data;
            if (collectedEvents.has(wireEvent.id)) {
              return;
            }

            const isValid = verifyEvent(wireEvent);
            if (!isValid) {
              this._logger.warn('Event signature verification failed', {
                eventId: wireEvent.id,
                relay: relayUrl
              });
              return;
            }

            const nostrEvent: NostrEvent = {
              id: wireEvent.id,
              pubkey: wireEvent.pubkey,
              createdAt: wireEvent.created_at,
              kind: wireEvent.kind,
              tags: wireEvent.tags,
              content: wireEvent.content,
              sig: wireEvent.sig
            };

            collectedEvents.set(wireEvent.id, {
              event: nostrEvent,
              verified: true
            });

            if (collectedEvents.size >= this._config.subscriptionLimit) {
              finish();
            }
          },
          oneose: () => {
            if (isDone) {
              return;
            }
            eoseRelays.add(relayUrl);
            if (eoseRelays.size >= relays.length) {
              finish();
            }
          }
        });
        activeSubs.push(sub);
      }
    });
  }

  public async fetchEventById(id: string): Promise<VerifiedNostrEvent | null> {
    if (!id || id.trim() === '') {
      return null;
    }
    try {
      const events = await this.fetchEvents([{ ids: [id], limit: 1 }]);
      return events[0] ?? null;
    } catch (err: unknown) {
      if (err instanceof NostrTimeoutError) {
        return null;
      }
      throw err;
    }
  }

  public async fetchEventsByAuthor(
    pubkey: string,
    options?: { kinds?: number[]; since?: number; until?: number; limit?: number }
  ): Promise<VerifiedNostrEvent[]> {
    const validHex = /^[0-9a-fA-F]{64}$/.test(pubkey);
    if (!validHex) {
      throw new NostrParseError('Invalid pubkey: must be a 64-character hexadecimal string', {
        input: pubkey,
        reason: 'Pubkey is not a 64-character hex string'
      });
    }

    const filter: NostrFilter = {
      authors: [pubkey.toLowerCase()],
      ...(options?.kinds !== undefined ? { kinds: options.kinds } : {}),
      ...(options?.since !== undefined ? { since: options.since } : {}),
      ...(options?.until !== undefined ? { until: options.until } : {}),
      ...(options?.limit !== undefined ? { limit: options.limit } : {})
    };

    return this.fetchEvents([filter]);
  }

  public async fetchEventsByTag(
    tag: '#e' | '#p' | '#d',
    value: string,
    options?: { limit?: number }
  ): Promise<VerifiedNostrEvent[]> {
    if (!value || value.trim() === '') {
      throw new NostrParseError('Tag value must be non-empty', {
        input: value,
        reason: 'Empty tag value'
      });
    }

    const filter: NostrFilter = {
      [tag]: [value],
      ...(options?.limit !== undefined ? { limit: options.limit } : {})
    };

    return this.fetchEvents([filter]);
  }

  public npubEncode(pubkeyHex: string): string {
    const validHex = /^[0-9a-fA-F]{64}$/.test(pubkeyHex);
    if (!validHex) {
      throw new NostrParseError('Invalid pubkey: must be a 64-character hexadecimal string', {
        input: pubkeyHex,
        reason: 'Expected 64-character hex string'
      });
    }
    try {
      return nip19.npubEncode(pubkeyHex.toLowerCase());
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new NostrParseError(`Failed to encode npub: ${reason}`, {
        input: pubkeyHex,
        reason
      }, err instanceof Error ? err : undefined);
    }
  }

  public npubDecode(npub: string): string {
    try {
      const decoded = nip19.decode(npub);
      if (decoded.type !== 'npub') {
        throw new NostrParseError('Invalid npub: decoded type is not npub', {
          input: npub,
          reason: `Expected npub type, got ${decoded.type}`
        });
      }
      return decoded.data;
    } catch (err: unknown) {
      if (err instanceof NostrParseError) {
        throw err;
      }
      const reason = err instanceof Error ? err.message : String(err);
      throw new NostrParseError(`Failed to decode npub: ${reason}`, {
        input: npub,
        reason
      }, err instanceof Error ? err : undefined);
    }
  }
}
