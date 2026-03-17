import type { Middleware } from "../../openapi/squad/index.js";

/**
 * Create authentication middleware for Squad API
 * @param token - OAuth access token (will add "Bearer " prefix)
 */
export function withAuth(token: string): Middleware {
  return {
    pre: async ctx => {
      if (!ctx.init.headers) ctx.init.headers = {};

      ctx.init.headers = {
        ...ctx.init.headers,
        authorization: `Bearer ${token}`,
      };
    },
  };
}
