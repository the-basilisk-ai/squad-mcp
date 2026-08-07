import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIntrospect = vi.fn();

vi.mock("./oauth.js", () => ({ introspectToken: mockIntrospect }));

const { squadOAuthProvider } = await import("./oauth-provider.js");

const provider = squadOAuthProvider({
  authUrl: "https://auth.example.com",
  resource: "https://mcp.example.com/mcp",
  scopes: ["read:workspace", "write:workspace"],
});

const verifier = provider.createTokenVerifier(
  new URL("https://mcp.example.com/mcp"),
);

beforeEach(() => {
  mockIntrospect.mockReset();
});

describe("squadOAuthProvider metadata", () => {
  it("advertises PropelAuth's OAuth 2.1 endpoints as the authorization server", () => {
    expect(provider.oauthMetadata).toMatchObject({
      issuer: "https://auth.example.com/oauth/2.1",
      authorization_endpoint: "https://auth.example.com/oauth/2.1/authorize",
      token_endpoint: "https://auth.example.com/oauth/2.1/token",
      jwks_uri: "https://auth.example.com/.well-known/jwks.json",
      response_types_supported: ["code"],
      code_challenge_methods_supported: ["S256"],
    });
    expect(provider.resource).toBe("https://mcp.example.com/mcp");
  });
});

describe("verifyAccessToken", () => {
  it("returns the introspected claims with the token's own expiry", async () => {
    mockIntrospect.mockResolvedValue({
      active: true,
      sub: "user-1",
      email: "pm@example.com",
      exp: 1893456000,
      scope: "read:workspace write:workspace",
      client_id: "client-1",
    });

    const authInfo = await verifier.verifyAccessToken("tok-1");

    expect(mockIntrospect).toHaveBeenCalledWith("tok-1");
    expect(authInfo).toMatchObject({
      token: "tok-1",
      clientId: "client-1",
      scopes: ["read:workspace", "write:workspace"],
      expiresAt: 1893456000,
    });
    expect(authInfo.extra).toMatchObject({ sub: "user-1" });
  });

  it("strips a Bearer prefix before introspecting", async () => {
    mockIntrospect.mockResolvedValue({ active: true, sub: "user-1", exp: 1 });

    const authInfo = await verifier.verifyAccessToken("Bearer tok-2");

    expect(mockIntrospect).toHaveBeenCalledWith("tok-2");
    expect(authInfo.token).toBe("tok-2");
  });

  it("derives a short expiry when introspection omits exp", async () => {
    mockIntrospect.mockResolvedValue({ active: true, sub: "user-1" });
    const before = Math.floor(Date.now() / 1000);

    const authInfo = await verifier.verifyAccessToken("tok-3");

    expect(authInfo.expiresAt).toBeGreaterThan(before);
    expect(authInfo.expiresAt).toBeLessThanOrEqual(before + 300);
  });

  it("reports an empty scope list when introspection omits scope", async () => {
    mockIntrospect.mockResolvedValue({ active: true, sub: "user-1", exp: 1 });

    await expect(verifier.verifyAccessToken("tok-4")).resolves.toMatchObject({
      scopes: [],
    });
  });

  it("rejects an inactive token", async () => {
    mockIntrospect.mockResolvedValue({ active: false });

    await expect(verifier.verifyAccessToken("tok-5")).rejects.toThrow(
      "Token is not active",
    );
  });
});

describe("mapAuthInfo", () => {
  const authInfo = (extra: Record<string, unknown>, scopes: string[] = []) => ({
    token: "tok",
    clientId: "client-1",
    scopes,
    expiresAt: 1893456000,
    extra,
  });

  it("maps sub and email onto the user and keeps the claims as the payload", () => {
    const mapped = provider.mapAuthInfo(
      authInfo({ sub: "user-1", email: "pm@example.com" }, ["read:workspace"]),
    );

    expect(mapped.user).toEqual({ id: "user-1", email: "pm@example.com" });
    expect(mapped.payload).toMatchObject({ sub: "user-1" });
    expect(mapped.permissions).toEqual(["read:workspace"]);
  });

  it("leaves email undefined when the claim is absent or not a string", () => {
    expect(provider.mapAuthInfo(authInfo({ sub: "user-1" })).user.email).toBe(
      undefined,
    );
    expect(
      provider.mapAuthInfo(authInfo({ sub: "user-1", email: 42 })).user.email,
    ).toBe(undefined);
  });

  it("rejects claims with no usable sub", () => {
    expect(() => provider.mapAuthInfo(authInfo({}))).toThrow('"sub" claim');
    expect(() => provider.mapAuthInfo(authInfo({ sub: 7 }))).toThrow(
      '"sub" claim',
    );
  });
});
