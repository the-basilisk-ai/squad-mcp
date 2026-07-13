import { initBaseAuth } from "@propelauth/node";
import { logger } from "../lib/logger.js";
import { getPropelAuthUrl } from "./config.js";
import { kv } from "./kv.js";

const JWT_DURATION_MINUTES = 60;
const CACHE_TTL_SECONDS = 55 * 60; // 5 min buffer before JWT expiry

// Lazy singleton — initialized on first use
let authInstance: ReturnType<typeof initBaseAuth> | null = null;

export function getPropelAuthClient(): ReturnType<typeof initBaseAuth> {
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

/**
 * Get a short-lived JWT for calling the Squad platform API on behalf of a
 * user. The API derives tenant context from the token's active org, so
 * tokens are minted and cached per (user, org) pair.
 */
export async function getServiceToken(
  userId: string,
  activeOrgId: string,
): Promise<string> {
  const cacheKey = `mcp:jwt:${userId}:${activeOrgId}`;
  const cached = await kv().get(cacheKey);
  if (cached) return cached;

  const auth = getPropelAuthClient();
  const result = await auth.createAccessToken({
    userId,
    durationInMinutes: JWT_DURATION_MINUTES,
    activeOrgId,
  });

  await kv().set(cacheKey, result.access_token, CACHE_TTL_SECONDS);
  logger.debug({ userId }, "Minted new service JWT for user");
  return result.access_token;
}
