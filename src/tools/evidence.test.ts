import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeOffsetCursor } from "../helpers/cursor.js";
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

const { registerEvidenceTools } = await import("./evidence.js");
const tools = captureTools(registerEvidenceTools);

beforeEach(() => {
  mockExecute.mockReset();
  mockGetUserContext.mockReset();
  mockGetUserContext.mockResolvedValue(userCtx);
});

describe("list_signals", () => {
  it("maps filters and excludes tombstoned by default, paginating via offset cursor", async () => {
    const rows = Array.from({ length: 26 }, (_, i) => ({
      id: `s${i}`,
      displayId: i + 1,
      contentSummary: `sig ${i}`,
      source: "slack",
      status: "active",
    }));
    byOperation(mockExecute, {
      SignalList: (vars: unknown) => {
        const v = vars as Record<string, unknown>;
        expect(v.source).toBe("slack");
        expect(v.status).toEqual(["active", "stale"]);
        expect(v.createdAfter).toBe("2026-07-01T00:00:00Z");
        expect(v.limit).toBe(26);
        return { signalList: rows };
      },
    });

    const parsed = parse(
      await tools.get("list_signals")!(
        { source: "slack", since: "2026-07-01T00:00:00Z" },
        authCtx,
      ),
    );

    expect(parsed.items).toHaveLength(25);
    expect(parsed.items[0].displayId).toBe("SI-1");
    expect(decodeOffsetCursor(parsed.nextCursor)).toBe(25);
  });
});

describe("find_similar_signals", () => {
  it("returns related signals for a display ID", async () => {
    byOperation(mockExecute, {
      GetSignalRelated: {
        signal: {
          id: "s1",
          displayId: 1,
          relatedSignals: [
            {
              id: "s2",
              displayId: 2,
              contentSummary: "same complaint",
              source: "zendesk",
            },
          ],
        },
      },
    });

    const parsed = parse(
      await tools.get("find_similar_signals")!({ signalId: "SI-1" }, authCtx),
    );
    expect(parsed.items[0].displayId).toBe("SI-2");
  });
});

describe("get_cluster", () => {
  it("caps member signals at 15 with a note", async () => {
    byOperation(mockExecute, {
      GetCluster: {
        cluster: {
          id: "c1",
          displayId: 4,
          label: "Billing confusion",
          memberCount: 40,
          signals: Array.from({ length: 40 }, (_, i) => ({
            id: `s${i}`,
            displayId: i,
            contentSummary: `sig ${i}`,
          })),
          linkedInsights: [{ id: "i1", displayId: 9, title: "Insight" }],
        },
      },
    });

    const parsed = parse(
      await tools.get("get_cluster")!({ clusterId: "c1" }, authCtx),
    );
    expect(parsed.memberSignals).toHaveLength(15);
    expect(parsed.memberNote).toContain("40");
    expect(parsed.linkedInsights[0].displayId).toBe("IN-9");
  });
});

describe("list_insights", () => {
  it("routes goal-scoped listing through the goal query", async () => {
    byOperation(mockExecute, {
      GoalInsights: {
        goal: {
          id: "g1",
          insights: [
            {
              id: "i1",
              displayId: 3,
              title: "T",
              evidenceCount: 5,
              combinedScore: 0.8,
            },
          ],
        },
      },
    });

    const parsed = parse(
      await tools.get("list_insights")!({ goalId: "GL-1" }, authCtx),
    );
    expect(parsed.items[0].displayId).toBe("IN-3");
    expect(parsed.items[0].counts.evidence).toBe(5);
  });

  it("maps score filter onto insightList", async () => {
    byOperation(mockExecute, {
      InsightList: (vars: unknown) => {
        expect((vars as { minCombinedScore: number }).minCombinedScore).toBe(
          0.5,
        );
        return { insightList: [] };
      },
    });

    const parsed = parse(
      await tools.get("list_insights")!({ minScore: 0.5 }, authCtx),
    );
    expect(parsed.items).toEqual([]);
  });
});
