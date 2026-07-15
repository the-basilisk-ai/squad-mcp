# Squad MCP Server - Usage Examples

These examples demonstrate real-world usage of the Squad MCP server with Claude. Each shows the user prompt, the tools that get called behind the scenes, and the expected outcome.

Squad turns raw user feedback into an **evidence chain**: feedback lands as **signals** (`SI-`), which cluster into recurring themes (`CL-`), distil into **insights** (`IN-`), and point at the **actions** (`AC-`) and **goals** (`GL-`) that move the product. From there you can generate **decision briefs** (`OP-`) and store **documents** (`DC-`). Every answer cites these display IDs so you can trace it back to real customer evidence.

---

## Example 1: Orient in a Workspace

### User Prompt
```
"What's going on in my Squad workspace this week?"
```

### What Happens Behind the Scenes
1. Claude calls `get_workspace_overview` — one call returns the mission, top goals, recent signal activity by source, evidence-chain health, and open work counts.

### Actual Output
```
**Acme Platform** — Mission: "Make onboarding effortless for every new team."

**Top goals:**
- GL-1 Reduce time-to-first-value (importance 5)
- GL-3 Cut onboarding support tickets (importance 4)

**Signal activity (last 7 days):** 42 signals — zendesk 21, intercom 12, gong 9

**Chain health:** 6 clusters, 4 insights linked to goals, 2 insights unlinked

**Open work:** 7 open actions · 2 decision briefs pending review

[Open in Squad](https://app.meetsquad.ai/acme/platform)
```

**Tools Called:** `get_workspace_overview`

**Value Delivered:** A single orientation call before any deeper work — no need to stitch together several list calls to understand the current state.

> If you belong to more than one workspace, Claude will call `list_workspaces` and `select_workspace` first (or a tool will report that a selection is required).

---

## Example 2: Triage a Piece of Feedback

### User Prompt
```
"A customer on Zendesk said: 'The CSV export times out on anything over
10k rows.' Capture this and tell me if it's a known theme."
```

### What Happens Behind the Scenes
1. Claude calls `search` with the key phrases to see whether this is already known.
2. Claude calls `ingest_signal` with the feedback (`source: zendesk`, plus `sourceUrl`/`author` when known). Content is deduplicated semantically server-side.
3. Clustering and insight extraction run asynchronously.

### Actual Output
```
Captured as **SI-214** (source: zendesk).

This is a known theme — it merged into an existing signal and sits in cluster
**CL-8 "Export reliability at scale"** (11 signals). It already backs insight
**IN-19 "Large exports fail silently"** (combined score 78, 11 signals).

Clustering/insight updates run in the background — check get_activity or
list_signals shortly to see it reflected.
```

**Tools Called:** `search`, then `ingest_signal` (batch of 1–50 items supported)

**Value Delivered:** Feedback is captured once, de-duplicated automatically, and immediately placed in the context of existing evidence — so you learn how widespread a complaint is, not just that it happened.

---

## Example 3: Explore a Theme and Its Evidence

### User Prompt
```
"What are people saying about exports? Show me the insight and the
actual quotes behind it."
```

### What Happens Behind the Scenes
1. Claude calls `list_insights` (ranked by combined score) — or `list_clusters` to browse recurring themes.
2. For the top insight, Claude calls `get_entity(IN-19, include: ["evidence"])` to pull the supporting signals with their source links.

### Actual Output
```
**IN-19 — "Large exports fail silently"** (combined score 78 · 11 signals · linked to GL-3)

The evidence:
- SI-214 (zendesk): "CSV export times out on anything over 10k rows"
  → https://acme.zendesk.com/tickets/8821
- SI-198 (intercom): "Export just spins forever for our biggest board"
- SI-176 (gong): Enterprise call — "we gave up exporting and use the API now"

This theme sits in cluster CL-8 "Export reliability at scale" and supports
goal GL-3 (Cut onboarding support tickets). There's an open action against it:
AC-31 "Stream large exports instead of buffering".
```

**Tools Called:** `list_insights`, `get_entity` with `include: ["evidence"]` (also `get_cluster` / `find_similar_signals` when drilling into a specific theme)

**Value Delivered:** Insights are grounded in verbatim customer quotes with source links — the assistant never hand-waves; it cites the signals.

---

## Example 4: Weekly Product Review

### User Prompt
```
"Run my weekly product review — what changed, what the evidence says,
and what needs deciding?"
```

### What Happens Behind the Scenes
1. `get_workspace_overview` for the current state.
2. `get_activity` to see what changed — including what Squad's agents did versus humans.
3. `list_insights` sorted by score for the strongest evidence; `get_entity` with `include: ["evidence"]` on the top few to ground them.
4. `list_actions` for open work and `list_one_pagers` with status `["draft", "in_review"]` for briefs awaiting a decision.

### Actual Output
```
**Weekly Product Review — Acme Platform**

*What changed*
- 42 new signals (zendesk 21, intercom 12, gong 9); export complaints up 3×
- New insight IN-22 "Onboarding checklist ignored on mobile" auto-distilled
- AC-31 moved to in_progress

*What the evidence says*
- IN-19 "Large exports fail silently" (score 78) — SI-214, SI-198, SI-176
- IN-22 "Checklist ignored on mobile" (score 61) — SI-230, SI-231

*Decisions waiting*
- OP-4 "Stream large exports" — in_review, recommends shipping streaming
- Top open action: AC-31 (P1) linked to GL-3

*Suggested focus:* finalise OP-4 and scope the mobile checklist fix.

[Open in Squad](https://app.meetsquad.ai/acme/platform)
```

**Tools Called:** `get_workspace_overview`, `get_activity`, `list_insights`, `get_entity`, `list_actions`, `list_one_pagers`

> This flow is also available as the **`weekly-product-review`** prompt — invoke it directly instead of typing the whole request.

**Value Delivered:** A one-page, evidence-cited review assembled from live data, distinguishing agent-driven changes from human ones.

---

## Example 5: Ground a Ticket Before Building

### User Prompt
```
"I'm about to pick up AC-31. Pull the customer evidence behind it first."
```

### What Happens Behind the Scenes
1. Claude calls `get_action_context(AC-31)` — one call returns the action, the insight that motivates it, the top customer signals with source links, and the goals it serves.

### Actual Output
```
**AC-31 — "Stream large exports instead of buffering"** (P1 · in_progress · effort M)

*Why:* IN-19 "Large exports fail silently" (score 78, 11 signals) — buffering
the full result set exhausts memory on large boards.

*Customer evidence:*
- SI-214 (zendesk): "CSV export times out on anything over 10k rows" → ticket link
- SI-198 (intercom): "Export just spins forever for our biggest board"
- SI-176 (gong): "we gave up exporting and use the API now"

*Serves:* GL-3 Cut onboarding support tickets (importance 4)

Acceptance hints implied by the evidence: exports of 10k+ rows should complete
without timing out; failures should surface an error rather than spin silently.

When you ship, close the loop: update_action_status AC-31 → completed with a
note referencing the PR.
```

**Tools Called:** `get_action_context`

> Also available as the **`ground-this-ticket`** prompt — handy for coding agents that need the "why" before implementing.

**Value Delivered:** Everything needed to execute an action in a single call, so work stays anchored to real customer evidence and the strategic goal it serves.

---

## Example 6: Generate a Decision Brief

### User Prompt
```
"Draft a decision brief for AC-31 so we can decide whether to prioritise it."
```

### What Happens Behind the Scenes
1. Claude calls `generate_one_pager(actionId: "AC-31")` — generation is asynchronous and returns a new `OP-` ID with status `building`.
2. Claude polls `get_entity(OP-N)` until the status moves past `building`.
3. Once finalised in review, `update_one_pager_status` moves it to `in_review` or `finalised`.

### Actual Output
```
Started decision brief **OP-7** (status: building) from AC-31…
…finished.

**OP-7 — "Stream large exports"**
*Recommendation:* Ship streaming exports next sprint.
*Evidence:* 11 signals across zendesk/intercom/gong (SI-214, SI-198, SI-176 …),
tied to GL-3. Support ticket volume from exports is trending up 3× this month.
*Gaps:* No data on export sizes above 100k rows — worth a research question.

Moved to in_review so the team can sign off. Open it: OP-7 → decision brief.
```

**Tools Called:** `generate_one_pager`, `get_entity` (polling), `update_one_pager_status`

> This is the **`draft-decision-brief`** prompt end to end. You can also generate a brief from an insight (`insightId: "IN-19"`) or retry a failed one (`retryOnePagerId`).

**Value Delivered:** A decision-ready, evidence-cited brief produced by Squad's generation pipeline and walked through its review lifecycle — no manual synthesis.

---

## Example 7: Search Everything

### User Prompt
```
"Find everything in my workspace related to onboarding friction."
```

### What Happens Behind the Scenes
1. Claude calls `search` with the query. Results span signals, insights, actions, goals, documents, and clusters, and come back as display IDs.
2. Claude follows the best matches with `get_entity` (or `get_action_context` for actions).

### Actual Output
```
Matches for "onboarding friction":

Insights
- IN-22 Onboarding checklist ignored on mobile
- IN-9  Setup wizard abandoned at step 3

Clusters
- CL-2 First-run confusion (14 signals)

Actions
- AC-18 Simplify the setup wizard

Documents
- DC-5 Onboarding research summary (Q2)

Ask me to open any of these — e.g. "show the evidence behind IN-22".
```

**Tools Called:** `search` (optionally restricted with `types: ["insight", "action", …]`), then `get_entity`

**Value Delivered:** Fast keyword search across every entity type, returning citable IDs you can drill into immediately.

---

## Quick Reference: Common Workflows

| User Goal | Example Prompt | Key Tools Used |
|-----------|----------------|----------------|
| **Orient** | "What's going on this week?" | `get_workspace_overview` |
| **Capture feedback** | "Log this ticket in Squad" | `search`, `ingest_signal` |
| **Explore a theme** | "What are people saying about exports?" | `list_insights`, `list_clusters`, `get_cluster` |
| **See the evidence** | "Show the quotes behind IN-19" | `get_entity` with `include: ["evidence"]` |
| **Weekly review** | "Run my weekly product review" | `get_activity`, `list_insights`, `list_actions`, `list_one_pagers` |
| **Ground a ticket** | "Pull the evidence behind AC-31" | `get_action_context` |
| **Decide** | "Draft a decision brief for AC-31" | `generate_one_pager`, `update_one_pager_status` |
| **Search** | "Find everything about onboarding" | `search`, `get_entity` |
| **Switch context** | "Switch to my other workspace" | `list_workspaces`, `select_workspace` |

### Prompts (ready-made workflows)

Several of the flows above ship as MCP **prompts** you can invoke directly: `triage-feedback`, `weekly-product-review`, `draft-decision-brief`, and `ground-this-ticket`.

### Resources (pinnable context)

Pin `squad://workspace/context` (mission + product context) and `squad://goals` (strategic goals) so strategy questions need no tool calls at all.

---

## Tips for Best Results

1. **Orient first** — start a session with `get_workspace_overview` (or pin the workspace-context resource) so later answers have grounding.
2. **Reference display IDs** — mention `IN-19`, `AC-31`, `CL-8`, etc. and Claude will fetch exactly that entity.
3. **Ask for the evidence** — "show the quotes / signals behind this" pulls verbatim customer feedback with source links.
4. **Search before ingesting** — for one-off feedback, a quick `search` or `find_similar_signals` avoids duplicates (ingest also de-dupes server-side).
5. **Async work polls** — brief generation and clustering run in the background; Claude polls `get_entity` / checks `get_activity` until they land.
6. **Use natural language** — no need to know tool names; just describe what you want.

---

## Authentication Note

All examples require OAuth authentication on first use. Claude prompts you to log in via your browser, then maintains the session across requests. Data is isolated per workspace and respects Squad's access controls. Write tools (ingest, create/update, generate) require a token minted with the `write:workspace` scope.

---

## More Information

- **Full Tool Reference:** See [README.md](./README.md#-available-tools) for the complete tool list, prompts, and resources.
- **Squad Platform:** Visit [meetsquad.ai](https://meetsquad.ai).
- **Support:** Create an issue at [github.com/the-basilisk-ai/squad-mcp/issues](https://github.com/the-basilisk-ai/squad-mcp/issues).
