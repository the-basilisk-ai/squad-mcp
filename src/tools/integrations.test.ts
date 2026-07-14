import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  authCtx,
  byOperation,
  captureTools,
  parse,
  userCtx,
} from "./test-utils.js";

const mockExecute = vi.fn();
const mockGetUserContext = vi.fn();

vi.mock("../lib/squad-api-client.js", async importOriginal => ({
  ...(await importOriginal<object>()),
  execute: mockExecute,
}));
vi.mock("../helpers/getUser.js", async importOriginal => ({
  ...(await importOriginal<object>()),
  getUserContext: mockGetUserContext,
}));
vi.mock("../lib/logger.js", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const { registerIntegrationTools } = await import("./integrations.js");
const tools = captureTools(registerIntegrationTools);

beforeEach(() => {
  mockExecute.mockReset();
  mockGetUserContext.mockReset();
  mockGetUserContext.mockResolvedValue(userCtx);
});

describe("list_integrations", () => {
  it("summarises each integration's sync health from its triggers", async () => {
    byOperation(mockExecute, {
      IntegrationList: {
        integrationList: [
          {
            id: "int-1",
            name: "Acme Slack",
            provider: "slack",
            status: "active",
            triggers: [
              {
                id: "t1",
                lastSyncedAt: "2026-07-10T00:00:00.000Z",
                syncTotal: 12,
              },
              {
                id: "t2",
                lastSyncedAt: "2026-07-14T00:00:00.000Z",
                syncTotal: 8,
              },
            ],
          },
        ],
      },
    });

    const parsed = parse(await tools.get("list_integrations")!({}, authCtx));

    expect(parsed.items[0].status).toBe("active");
    expect(parsed.items[0].extra.provider).toBe("slack");
    expect(parsed.items[0].extra.sourceCount).toBe(2);
    expect(parsed.items[0].extra.lastSyncedAt).toBe("2026-07-14T00:00:00.000Z");
    expect(parsed.items[0].extra.signalsPulled).toBe(20);
  });

  it("reports no synced sources when triggers have never run", async () => {
    byOperation(mockExecute, {
      IntegrationList: {
        integrationList: [
          {
            id: "int-2",
            provider: "intercom",
            status: "pending",
            triggers: [],
          },
        ],
      },
    });

    const parsed = parse(await tools.get("list_integrations")!({}, authCtx));

    expect(parsed.items[0].title).toBe("intercom");
    expect(parsed.items[0].extra.lastSyncedAt).toBeNull();
    expect(parsed.items[0].extra.signalsPulled).toBe(0);
  });

  it("guides the user when nothing is connected", async () => {
    byOperation(mockExecute, { IntegrationList: { integrationList: [] } });

    const parsed = parse(await tools.get("list_integrations")!({}, authCtx));

    expect(parsed.message).toContain("No integrations connected");
  });
});
