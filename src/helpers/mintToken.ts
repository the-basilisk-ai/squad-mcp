import { initBaseAuth } from "@propelauth/node";
import { logger } from "../lib/logger.js";
import { getPropelAuthUrl } from "./config.js";

const JWT_DURATION_MINUTES = 60;
const CACHE_TTL_MS = 55 * 60 * 1000; // 55 min (5 min buffer before JWT expiry)
const CACHE_MAX_SIZE = 10_000; // max concurrent users before eviction
const EVICTION_RATIO = 0.1;

type CachedToken = {
  jwt: string;
  createdAt: number;
};

// In-memory only — lost on restart, which just means a few extra createAccessToken calls to warm up.
const tokenCache = new Map<string, CachedToken>();
let cacheHits = 0;
let cacheMisses = 0;

// Lazy singleton — initialized on first use
let authInstance: ReturnType<typeof initBaseAuth> | null = null;

function getAuth(): ReturnType<typeof initBaseAuth> {
  if (!authInstance) {
    const apiKey = process.env.PROPELAUTH_API_KEY;
    if (!apiKey) {
      throw new Error("Missing PROPELAUTH_API_KEY environment variable");
    }
    authInstance = initBaseAuth({
      authUrl: getPropelAuthUrl(),
      apiKey,
    });
  }
  return authInstance;
}

function evictOldest(): void {
  if (tokenCache.size < CACHE_MAX_SIZE) return;
  const entries = Array.from(tokenCache.entries());
  entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
  const evictCount = Math.ceil(CACHE_MAX_SIZE * EVICTION_RATIO);
  for (let i = 0; i < evictCount && i < entries.length; i++) {
    tokenCache.delete(entries[i][0]);
  }
}

function removeExpired(): void {
  const now = Date.now();
  for (const [userId, entry] of tokenCache.entries()) {
    if (now - entry.createdAt > CACHE_TTL_MS) {
      tokenCache.delete(userId);
    }
  }
}

// Periodic cleanup and stats logging
setInterval(
  () => {
    removeExpired();
    const total = cacheHits + cacheMisses;
    if (total > 0) {
      logger.info(
        {
          cacheHits,
          cacheMisses,
          cacheSize: tokenCache.size,
          hitRate: `${Math.round((cacheHits / total) * 100)}%`,
        },
        "JWT token cache stats",
      );
      cacheHits = 0;
      cacheMisses = 0;
    }
  },
  60 * 60 * 1000,
);

/**
 * Get a short-lived JWT for calling the Squad API on behalf of a user.
 * Mints via PropelAuth createAccessToken and caches per userId.
 */
export async function getServiceToken(userId: string): Promise<string> {
  const cached = tokenCache.get(userId);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    cacheHits++;
    return cached.jwt;
  }
  cacheMisses++;

  const auth = getAuth();
  const result = await auth.createAccessToken({
    userId,
    durationInMinutes: JWT_DURATION_MINUTES,
  });

  evictOldest();
  tokenCache.set(userId, { jwt: result.access_token, createdAt: Date.now() });

  logger.debug({ userId }, "Minted new service JWT for user");
  return result.access_token;
}
