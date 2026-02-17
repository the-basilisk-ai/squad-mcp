/**
 * The Squad API spec uses separate tags per resource (Solutions, Feedback, etc.)
 * for API documentation, but we want a single SquadApi client class. Without this,
 * the codegen produces separate files per tag (SolutionsApi.ts, FeedbackApi.ts, etc.)
 * which breaks our imports. This script unifies all tags to "Squad" before generation.
 */
import fs from "fs";

const spec = JSON.parse(fs.readFileSync("./openapi/squad.json", "utf8"));

for (const path of Object.values(spec.paths)) {
  for (const op of Object.values(path as Record<string, any>)) {
    if (op.tags) {
      op.tags = ["Squad"];
    }
  }
}

fs.writeFileSync("./openapi/squad.json", JSON.stringify(spec, null, 2) + "\n");
