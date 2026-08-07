import { OAuthError, OAuthErrorCode, oauthCustomProvider } from "mcp-use/oauth";
import type { SquadUser } from "../tools/helpers.js";
import { introspectToken } from "./oauth.js";

// Introspection returns `active` for a live token but `exp` is only a SHOULD in
// RFC 7662. The SDK bearer gate rejects an AuthInfo with no expiresAt, so cap
// the derived lifetime instead — every request re-introspects, so a short
// window costs nothing and never outlives the authorization server's answer.
const DERIVED_TOKEN_TTL_SECONDS = 300;

export type SquadOAuthOptions = {
  /** PropelAuth base URL. */
  authUrl: string;
  /** Canonical public MCP endpoint URL. */
  resource: string;
  scopes: readonly string[];
};

/**
 * PropelAuth as an OAuth 2.1 authorization server, with this process acting as
 * the resource server. Every request re-introspects its bearer token: v2 keeps
 * no session, so there is nothing to cache an identity against.
 */
export function squadOAuthProvider({
  authUrl,
  resource,
  scopes,
}: SquadOAuthOptions) {
  const issuer = `${authUrl}/oauth/2.1`;

  return oauthCustomProvider<SquadUser>({
    resource,
    scopesSupported: scopes,
    resourceName: "Squad",
    oauthMetadata: {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      jwks_uri: `${authUrl}/.well-known/jwks.json`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      scopes_supported: [...scopes],
      code_challenge_methods_supported: ["S256"],
    },
    createTokenVerifier: canonicalResource => ({
      verifyAccessToken: async (token: string) => {
        const bare = token.startsWith("Bearer ") ? token.slice(7) : token;
        const result = await introspectToken(bare);

        if (!result.active) {
          throw new OAuthError(
            OAuthErrorCode.InvalidToken,
            "Token is not active",
          );
        }

        return {
          token: bare,
          clientId: result.client_id ?? "",
          scopes: result.scope ? result.scope.split(/\s+/).filter(Boolean) : [],
          expiresAt:
            result.exp ??
            Math.floor(Date.now() / 1000) + DERIVED_TOKEN_TTL_SECONDS,
          // The bearer gate refuses any AuthInfo without a validated resource.
          // Introspection is authenticated with this server's own client
          // credentials, so an active response means the authorization server
          // issued the token to this client: that is the audience binding.
          resource: canonicalResource,
          extra: { ...result },
        };
      },
    }),
    mapAuthInfo: authInfo => {
      const payload = (authInfo.extra ?? {}) as Record<string, unknown>;
      if (typeof payload.sub !== "string") {
        throw new OAuthError(
          OAuthErrorCode.InvalidToken,
          'Token missing required "sub" claim',
        );
      }
      return {
        user: {
          id: payload.sub,
          email: typeof payload.email === "string" ? payload.email : undefined,
        },
        payload,
        permissions: authInfo.scopes,
      };
    },
  });
}
