/**
 * Tool-facing enum value sets mirrored from the Squad platform. Constraining
 * the tool schemas surfaces the valid options to the agent and validates
 * client-side. Keep in sync with the platform (packages/db/src/schema/tables.ts
 * and the GraphQL schema).
 *
 * INSIGHT_CATEGORIES / INSIGHT_STATUSES map to real pgEnums
 * (insight_category / insight_status) — the platform hard-rejects values
 * outside these. SIGNAL_SOURCES / SIGNAL_TYPES mirror the GraphQL SignalSource /
 * SignalType enums used for filtering; note signal source is stored free-form
 * (varchar) at ingest, so these are the canonical filter set, not a hard limit.
 */

/** SignalSource — the canonical set of signal sources (used for filtering). */
export const SIGNAL_SOURCES = [
  "agent",
  "amplitude",
  "api",
  "app_store",
  "capterra",
  "document",
  "file_upload",
  "g2",
  "github",
  "gong",
  "google_play",
  "google_reviews",
  "intercom",
  "jira",
  "linear",
  "manual",
  "notion",
  "posthog",
  "research",
  "salesforce",
  "slack",
  "trustpilot",
  "typeform",
  "webhook",
  "website",
  "zendesk",
] as const;

/** SignalType — the kind of feedback a signal represents. */
export const SIGNAL_TYPES = [
  "agent_insight",
  "bug_report",
  "churn_risk",
  "competitive_intel",
  "feature_request",
  "pain_point",
  "praise",
] as const;

/** insight_category pgEnum. */
export const INSIGHT_CATEGORIES = [
  "pain_point",
  "feature_request",
  "positive_signal",
  "trend",
  "risk",
] as const;

/** insight_status pgEnum. */
export const INSIGHT_STATUSES = [
  "active",
  "stale",
  "archived",
  "resolved",
] as const;
