/**
 * Tool-facing enums mirrored from the Squad platform's GraphQL/pgEnum
 * definitions. The backend rejects values outside these sets, so constraining
 * the tool schemas here surfaces the valid options to the agent and fails fast
 * client-side instead of on a round-trip. Keep in sync with the platform
 * (packages/db/src/schema/tables.ts and the GraphQL schema).
 */

/** SignalSource — where a signal came from. */
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
