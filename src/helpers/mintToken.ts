import { initBaseAuth } from "@propelauth/node";
import { getPropelAuthUrl } from "./config.js";
import { logger } from "../lib/logger.js";

const JWT_DURATION_MINUTES = 60;
const CACHE_TTL_MS = 55 * 60 * 1000; // 55 min (5 min buffer before JWT expiry)
const CACHE_MAX_SIZE = 10_000;

type CachedToken = {
  jwt: string;
  createdAt: number;
};

const tokenCache = new Map<string, CachedToken>();

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
  const evictCount = Math.ceil(CACHE_MAX_SIZE * 0.1);
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

// Hourly cleanup (mirrors workspace cache pattern in getUser.ts)
setInterval(removeExpired, 60 * 60 * 1000);

/**
 * Get a short-lived JWT for calling the Squad API on behalf of a user.
 * Mints via PropelAuth createAccessToken and caches per userId.
 */
export async function getServiceToken(userId: string): Promise<string> {
  const cached = tokenCache.get(userId);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.jwt;
  }

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
