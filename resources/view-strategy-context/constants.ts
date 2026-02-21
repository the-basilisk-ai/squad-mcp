import type { EntityType } from "./types";

export const TYPE_LABELS: Record<EntityType, string> = {
  workspace: "North Star",
  goal: "Goal",
  opportunity: "Opportunity",
  solution: "Solution",
  insight: "Insight",
  feedback: "Feedback",
};

export const TYPE_PLURALS: Record<string, string> = {
  goal: "Goals",
  opportunity: "Opportunities",
  solution: "Solutions",
  insight: "Insights",
  feedback: "Feedback",
};

export const STATUS_DISPLAY: Record<string, string> = {
  New: "New",
  InProgress: "In Progress",
  InDevelopment: "In Development",
  Planned: "Planned",
  Complete: "Complete",
  Solved: "Solved",
  Live: "Live",
  Cancelled: "Cancelled",
  Backlog: "Backlog",
  Feedback: "Feedback",
  Bug: "Bug",
  FeatureRequest: "Feature Request",
};

export const STATUS_COLORS_LIGHT: Record<string, string> = {
  New: "#7e22ce",
  Planned: "#b45309",
  InProgress: "#1d4ed8",
  InDevelopment: "#1d4ed8",
  Complete: "#15803d",
  Solved: "#15803d",
  Live: "#b91c1c",
  Cancelled: "#9ca3af",
  Backlog: "#9ca3af",
  Feedback: "#0e7490",
  Bug: "#b91c1c",
  FeatureRequest: "#7e22ce",
};

export const STATUS_COLORS_DARK: Record<string, string> = {
  New: "#c084fc",
  Planned: "#fbbf24",
  InProgress: "#60a5fa",
  InDevelopment: "#60a5fa",
  Complete: "#4ade80",
  Solved: "#4ade80",
  Live: "#f87171",
  Cancelled: "#71717a",
  Backlog: "#71717a",
  Feedback: "#22d3ee",
  Bug: "#f87171",
  FeatureRequest: "#c084fc",
};

export const ASSET_BASE = "https://assets.meetsquad.ai/integration-logos/";

export const SOURCES: Record<string, { label: string; logo: string | null }> = {
  NOTION: { label: "Notion", logo: "notion.webp" },
  APP_STORE_REVIEWS: { label: "App Store Reviews", logo: "app-store.webp" },
  PLAY_STORE_REVIEWS: {
    label: "Play Store Reviews",
    logo: "play-store.webp",
  },
  GOOGLE_REVIEWS: { label: "Google Reviews", logo: "google-reviews.webp" },
  TRUSTPILOT_REVIEWS: { label: "Trustpilot", logo: "trustpilot.webp" },
  TYPEFORM: { label: "Typeform", logo: "typeform.png" },
  SLACK: { label: "Slack", logo: "slack.png" },
  SQUAD_API: { label: "Squad API", logo: "squad-api.webp" },
  SQUAD_MCP: { label: "Squad MCP", logo: "squad-mcp.webp" },
  ZAPIER: { label: "Zapier", logo: "zapier.webp" },
  INTERCOM: { label: "Intercom", logo: "intercom.webp" },
  GONG: { label: "Gong", logo: "gong.webp" },
  SURVEY_MONKEY: { label: "Survey Monkey", logo: "survey-monkey.webp" },
  DOVETAIL: { label: "Dovetail", logo: "dovetail.webp" },
  ZENDESK: { label: "Zendesk", logo: "zendesk.webp" },
  HELP_SCOUT: { label: "Help Scout", logo: "help-scout.webp" },
  ZOOM: { label: "Zoom", logo: "zoom.webp" },
  GOOGLE_MEET: { label: "Google Meet", logo: "google-meet.webp" },
  MICROSOFT_TEAMS: {
    label: "Microsoft Teams",
    logo: "microsoft-teams.webp",
  },
  LINEAR: { label: "Linear", logo: "linear.webp" },
  ATLASSIAN_JIRA: { label: "Atlassian Jira", logo: "atlassian-jira.webp" },
  ASANA: { label: "Asana", logo: "asana.webp" },
  GOOGLE_ANALYTICS: {
    label: "Google Analytics",
    logo: "google-analytics.webp",
  },
  FULLSTORY: { label: "FullStory", logo: "fullstory.webp" },
  AMPLITUDE: { label: "Amplitude", logo: "amplitude.webp" },
  MANUAL: { label: "Manual", logo: null },
  OTHER: { label: "Other", logo: null },
};

export function entityUrl(
  type: string,
  id: string,
  appBaseUrl?: string,
): string {
  if (!appBaseUrl || !id) return "";
  const path =
    type === "insight" || type === "feedback" ? "/insights" : "/strategy";
  return `${appBaseUrl}${path}?p=${encodeURIComponent(type)}&i=${encodeURIComponent(id)}`;
}

export function formatSource(source: string): string {
  return source
    .toLowerCase()
    .split("_")
    .map(s => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}

export function getStatusColor(
  status: string | undefined,
  isDark: boolean,
): string {
  if (!status) return "#9ca3af";
  const colors = isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
  return colors[status] || "#9ca3af";
}
