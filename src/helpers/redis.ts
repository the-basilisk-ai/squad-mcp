import { RedisSessionStore, RedisStreamManager } from "mcp-use/server";
import { createClient } from "redis";
import { logger } from "../lib/logger.js";

export async function connectRedis(): Promise<{
  sessionStore: RedisSessionStore;
  streamManager: RedisStreamManager;
}> {
  const redis = createClient({ url: process.env.REDIS_URL });
  const pubSubRedis = redis.duplicate();

  await redis.connect();
  await pubSubRedis.connect();

  logger.info("Redis session store connected");

  return {
    sessionStore: new RedisSessionStore({ client: redis, defaultTTL: 3600 }),
    streamManager: new RedisStreamManager({
      client: redis,
      pubSubClient: pubSubRedis,
    }),
  };
}
