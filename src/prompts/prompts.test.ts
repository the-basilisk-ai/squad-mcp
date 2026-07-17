import { describe, expect, it, vi } from "vitest";
import { captureTools } from "../tools/test-utils.js";

vi.mock("../lib/logger.js", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock("../lib/telemetry.js", () => ({
  captureToolCall: vi.fn(),
}));

const { PROMPTS } = await import("./index.js");
const { registerWorkspaceTools } = await import("../tools/workspace.js");
const { registerSearchTools } = await import("../tools/search.js");
const { registerEntityTools } = await import("../tools/get-entity.js");
const { registerEvidenceTools } = await import("../tools/evidence.js");
const { registerActionReadTools } = await import("../tools/actions-read.js");
const { registerStrategyReadTools } = await import("../tools/strategy-read.js");
const { registerIngestTools } = await import("../tools/ingest.js");
const { registerActionWriteTools } = await import("../tools/actions-write.js");
const { registerStrategyWriteTools } = await import(
  "../tools/strategy-write.js"
);
const { registerResearchWriteTools } = await import(
  "../tools/research-write.js"
);
const { registerKnowledgeTools } = await import("../tools/knowledge.js");

const registeredTools = new Set(
  [
    registerWorkspaceTools,
    registerSearchTools,
    registerEntityTools,
    registerEvidenceTools,
    registerActionReadTools,
    registerStrategyReadTools,
    registerIngestTools,
    registerActionWriteTools,
    registerStrategyWriteTools,
    registerResearchWriteTools,
    registerKnowledgeTools,
  ].flatMap(register => [...captureTools(register).keys()]),
);

const TOOL_REFERENCE =
  /\b(?:get|list|search|ingest|update|create|generate|select|find|dismiss)_[a-z_]+\b/g;

describe("prompts", () => {
  it("registers the four workflow prompts", () => {
    expect(PROMPTS.map(p => p.name)).toEqual([
      "triage-feedback",
      "weekly-product-review",
      "draft-decision-brief",
      "ground-this-ticket",
    ]);
  });

  it.each(PROMPTS.map(p => [p.name, p] as const))(
    "%s references only tools that exist",
    (_name, prompt) => {
      const text = prompt.build({
        feedback_text: "x",
        source: "slack",
        since: "2026-07-01",
        id: "AC-1",
        topic_or_id: "AC-1",
      });
      const referenced = text.match(TOOL_REFERENCE) ?? [];
      expect(referenced.length).toBeGreaterThan(0);
      for (const tool of referenced) {
        expect(registeredTools).toContain(tool);
      }
    },
  );

  it("interpolates arguments into the message", () => {
    const text = PROMPTS[0].build({
      feedback_text: "Exports time out",
      source: "zendesk",
    });
    expect(text).toContain("Exports time out");
    expect(text).toContain("Source: zendesk");
  });
});
