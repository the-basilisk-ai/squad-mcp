import { createClient } from "redis";
import { logger } from "../lib/logger.js";

/**
 * Small key-value store for workspace selections and minted-token caching.
 * Redis-backed in deployment; in-memory fallback for local dev and tests.
 */
/** Keeps idle connections from being reaped. */
const PING_INTERVAL_MS = 30_000;
/** node-redis defaults to 5s. */
const CONNECT_TIMEOUT_MS = 10_000;

export interface KvStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

export class MemoryKv implements KvStore {
  private entries = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

class RedisKv implements KvStore {
  constructor(private client: ReturnType<typeof createClient>) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, { EX: ttlSeconds });
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}

let store: KvStore | null = null;

export async function initKv(redisUrl: string | undefined): Promise<void> {
  if (!redisUrl) {
    logger.warn(
      {},
      "REDIS_URL not set — workspace selections and token cache are in-memory (not deploy-safe)",
    );
    store = new MemoryKv();
    return;
  }
  const client = createClient({
    url: redisUrl,
    pingInterval: PING_INTERVAL_MS,
    socket: { connectTimeout: CONNECT_TIMEOUT_MS },
  });
  // Required before connect(): an 'error' event with no listener kills the
  // process. node-redis reconnects on its own, so only log here.
  client.on("error", err => logger.error({ err }, "Redis client error"));
  await client.connect();
  store = new RedisKv(client);
  logger.info("KV store connected to Redis");
}

export function kv(): KvStore {
  store ??= new MemoryKv();
  return store;
}

export function setKvForTests(testStore: KvStore): void {
  store = testStore;
}
