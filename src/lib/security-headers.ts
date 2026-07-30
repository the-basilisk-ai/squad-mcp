import type { MiddlewareHandler } from "hono";

// max-age must match the web app and API tiers. includeSubDomains and preload
// stay off while a subdomain still fails TLS, because preload cannot be undone
// for the life of the max-age.
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
};

/**
 * Railway's edge does not add either header, so they have to be set here.
 *
 * Applied after `next()` and onto `c.res.headers` directly, which is what Hono's
 * own secure-headers middleware does. Setting them before `next()` would not
 * survive a handler that returns its own `Response`, and the MCP transport does
 * exactly that for streamed replies.
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    c.res.headers.set(name, value);
  }
};
