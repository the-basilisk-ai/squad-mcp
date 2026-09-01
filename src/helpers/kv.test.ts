import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateClient = vi.fn();

vi.mock("redis", () => ({ createClient: mockCreateClient }));

vi.mock("../lib/logger.js", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// Must import after mocks are set up
const { initKv, kv } = await import("./kv.js");
const { logger } = await import("../lib/logger.js");

/** EventEmitter-based stand-in: emitting 'error' with no listener throws. */
class FakeRedisClient extends EventEmitter {
  /** Listener count observed at the moment connect() was called. */
  errorListenersAtConnect = -1;
  connect = vi.fn(async () => {
    this.errorListenersAtConnect = this.listenerCount("error");
  });
  get = vi.fn();
  set = vi.fn();
  del = vi.fn();
}

let client: FakeRedisClient;

beforeEach(() => {
  vi.clearAllMocks();
  client = new FakeRedisClient();
  mockCreateClient.mockReturnValue(client);
});

describe("initKv", () => {
  it("falls back to an in-memory store when REDIS_URL is unset", async () => {
    await initKv(undefined);
    expect(mockCreateClient).not.toHaveBeenCalled();
    await kv().set("k", "v", 60);
    expect(await kv().get("k")).toBe("v");
  });

  it("registers an error listener before connecting", async () => {
    await initKv("redis://localhost:6379");
    // Attaching after connect() would leave the initial connect unguarded.
    expect(client.errorListenersAtConnect).toBeGreaterThan(0);
  });

  it("logs a socket error instead of throwing it", async () => {
    await initKv("redis://localhost:6379");

    const err = Object.assign(new Error("read ETIMEDOUT"), {
      code: "ETIMEDOUT",
      errno: -110,
    });
    // Unhandled 'error' is fatal in Node — this is the regression.
    expect(() => client.emit("error", err)).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith({ err }, "Redis client error");
  });

  it("keeps idle connections alive and allows a slow initial connect", async () => {
    await initKv("redis://localhost:6379");
    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "redis://localhost:6379",
        pingInterval: expect.any(Number),
        socket: expect.objectContaining({
          connectTimeout: expect.any(Number),
        }),
      }),
    );
  });

  it("serves reads and writes through the connected client", async () => {
    await initKv("redis://localhost:6379");
    await kv().set("workspace:u1", "ws-1", 3600);
    expect(client.set).toHaveBeenCalledWith("workspace:u1", "ws-1", {
      EX: 3600,
    });
  });
});
