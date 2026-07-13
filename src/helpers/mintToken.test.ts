import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryKv, setKvForTests } from "./kv.js";

const mockCreateAccessToken = vi.fn();

vi.mock("@propelauth/node", () => ({
  initBaseAuth: () => ({ createAccessToken: mockCreateAccessToken }),
}));

vi.mock("./config.js", () => ({
  getPropelAuthUrl: () => "https://test.propelauthtest.com",
}));

vi.mock("../lib/logger.js", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Must import after mocks are set up
const { getServiceToken } = await import("./mintToken.js");

beforeEach(() => {
  vi.stubEnv("PROPELAUTH_API_KEY", "test-key");
  setKvForTests(new MemoryKv());
  mockCreateAccessToken.mockReset();
  mockCreateAccessToken.mockResolvedValue({ access_token: "jwt-token-123" });
});

describe("getServiceToken", () => {
  it("mints a JWT with the active org on first call", async () => {
    const token = await getServiceToken("user-1", "org-1");
    expect(token).toBe("jwt-token-123");
    expect(mockCreateAccessToken).toHaveBeenCalledWith({
      userId: "user-1",
      durationInMinutes: 60,
      activeOrgId: "org-1",
    });
  });

  it("returns cached token on subsequent calls", async () => {
    mockCreateAccessToken.mockResolvedValue({ access_token: "jwt-first" });
    const first = await getServiceToken("user-2", "org-1");

    mockCreateAccessToken.mockResolvedValue({ access_token: "jwt-second" });
    const second = await getServiceToken("user-2", "org-1");

    expect(first).toBe("jwt-first");
    expect(second).toBe("jwt-first"); // cached
    expect(mockCreateAccessToken).toHaveBeenCalledTimes(1);
  });

  it("mints new token after cache TTL expires", async () => {
    vi.useFakeTimers();
    mockCreateAccessToken.mockResolvedValue({ access_token: "jwt-old" });
    await getServiceToken("user-3", "org-1");

    vi.advanceTimersByTime(56 * 60 * 1000);

    mockCreateAccessToken.mockResolvedValue({ access_token: "jwt-new" });
    const token = await getServiceToken("user-3", "org-1");

    expect(token).toBe("jwt-new");
    expect(mockCreateAccessToken).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("caches independently per user and org", async () => {
    mockCreateAccessToken
      .mockResolvedValueOnce({ access_token: "jwt-a" })
      .mockResolvedValueOnce({ access_token: "jwt-b" });

    const a = await getServiceToken("user-a", "org-1");
    const b = await getServiceToken("user-a", "org-2");

    expect(a).toBe("jwt-a");
    expect(b).toBe("jwt-b");
    expect(mockCreateAccessToken).toHaveBeenCalledTimes(2);
  });
});
