import * as fs from 'fs';
import * as path from 'path';
import type { KeplerLogger } from '@kepler/shared';
import { NostrClient, NostrConfig, NostrKind } from '../../src';

function loadEnvFile(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) {
      return;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        continue;
      }
      const key = trimmed.slice(0, eqIndex).trim();
      let val = trimmed.slice(eqIndex + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
  }
}

loadEnvFile(path.resolve(__dirname, '../../../../.env'));
loadEnvFile(path.resolve(__dirname, '../../../backend/.env'));
loadEnvFile(path.resolve(__dirname, '../../.env'));

class IntegrationTestLogger implements KeplerLogger {
  public readonly debugLogs: Array<{ message: string; context?: Record<string, unknown> }> = [];
  public readonly infoLogs: Array<{ message: string; context?: Record<string, unknown> }> = [];
  public readonly warnLogs: Array<{ message: string; context?: Record<string, unknown> }> = [];
  public readonly errorLogs: Array<{ message: string; error?: unknown; context?: Record<string, unknown> }> = [];
  public readonly fatalLogs: Array<{ message: string; error: unknown; context?: Record<string, unknown> }> = [];

  public debug(message: string, context?: Record<string, unknown>): void {
    this.debugLogs.push({ message, context });
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.infoLogs.push({ message, context });
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.warnLogs.push({ message, context });
  }

  public error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    this.errorLogs.push({ message, error, context });
  }

  public fatal(message: string, error: unknown, context?: Record<string, unknown>): void {
    this.fatalLogs.push({ message, error, context });
  }
}

const isConfigured = Boolean(process.env['NOSTR_PRIVATE_KEY'] && process.env['NOSTR_RELAYS']);
const describeIntegration = isConfigured ? describe : describe.skip;

describeIntegration('NostrClient Integration', () => {
  let client: NostrClient;
  let logger: IntegrationTestLogger;

  beforeEach(() => {
    logger = new IntegrationTestLogger();
    const config = NostrConfig.fromEnv(process.env);
    client = new NostrClient(config, logger);
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  it('connect() succeeds against at least one public relay', async () => {
    await client.connect();
    expect(client.isConnected).toBe(true);
    expect(client.connectedRelays.length).toBeGreaterThan(0);
  }, 30000);

  it('fetchEvents([{ kinds: [1], limit: 1 }]) returns at least one verified event from a public relay', async () => {
    await client.connect();
    const events = await client.fetchEvents([{ kinds: [1], limit: 1 }], 15000);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.verified).toBe(true);
    expect(events[0]?.event.id).toBeDefined();
    expect(events[0]?.event.pubkey).toBeDefined();
    expect(events[0]?.event.sig).toBeDefined();
  }, 30000);

  it('fetchEventById(id) for a known recent event returns the same event', async () => {
    await client.connect();
    const recentEvents = await client.fetchEvents([{ kinds: [1], limit: 1 }], 15000);
    expect(recentEvents.length).toBeGreaterThan(0);

    const knownId = recentEvents[0]!.event.id;
    const fetched = await client.fetchEventById(knownId);
    expect(fetched).not.toBeNull();
    expect(fetched?.event.id).toBe(knownId);
    expect(fetched?.verified).toBe(true);
  }, 30000);

  it('publish a NostrKind.TextNote with content kepler integration test and then fetchEventById the returned id, verifying round-trip', async () => {
    await client.connect();
    const result = await client.publish({
      pubkey: client.config.publicKey,
      createdAt: Math.floor(Date.now() / 1000),
      kind: NostrKind.TextNote,
      tags: [['t', 'kepler-integration-test']],
      content: 'kepler integration test'
    });

    expect(result.acceptedBy.length).toBeGreaterThan(0);
    expect(result.event.id).toBeDefined();

    const fetched = await client.fetchEventById(result.event.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.event.id).toBe(result.event.id);
    expect(fetched?.event.content).toBe('kepler integration test');
    expect(fetched?.verified).toBe(true);
  }, 30000);

  it('publishDecision with a real payload, then fetchEvents for #d: <scenarioId> and assert the event is found', async () => {
    await client.connect();
    const scenarioId = `kepler_integration_${Date.now()}`;
    const payload = {
      scenarioId,
      decision: 'allow',
      protocol: 'nostr',
      evidenceHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      summary: 'kepler integration test decision'
    };

    const result = await client.publishDecision(payload);
    expect(result.acceptedBy.length).toBeGreaterThan(0);

    const fetchedEvents = await client.fetchEventsByTag('#d', scenarioId, { limit: 1 });
    expect(fetchedEvents.length).toBeGreaterThan(0);
    expect(fetchedEvents[0]?.event.id).toBe(result.event.id);
    expect(fetchedEvents[0]?.event.kind).toBe(NostrKind.AppSpecificData);
  }, 30000);

  it('npubEncode and npubDecode round-trip on the configured public key', () => {
    const npub = client.npubEncode(client.config.publicKey);
    expect(npub).toBe(client.config.npub);
    const decoded = client.npubDecode(npub);
    expect(decoded).toBe(client.config.publicKey);
  });
});
