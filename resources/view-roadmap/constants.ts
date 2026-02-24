export const HORIZON_LABELS: Record<string, string> = {
  now: "Now",
  next: "Next",
  later: "Later",
};

export const GOAL_COLORS = [
  {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
    dot: "bg-purple-500",
  },
  {
    bg: "bg-rose-100 dark:bg-rose-900/30",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
] as const;

export const HORIZON_HEADER_STYLES: Record<string, string> = {
  now: "border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300",
  next: "border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300",
  later: "border-gray-300 dark:border-zinc-600 text-gray-500 dark:text-zinc-400",
};

/** Status display labels — matches strategy-context STATUS_DISPLAY */
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
};

/** Status badge color classes — matches strategy-context STATUS_BADGE_CLASSES */
export const STATUS_BADGE_CLASSES: Record<string, string> = {
  New: "bg-background-purple text-content-purple dark:bg-background-purple-dark dark:text-content-purple-dark",
  Planned:
    "bg-background-warning text-content-warning dark:bg-background-warning-dark dark:text-content-warning-dark",
  InProgress:
    "bg-background-info text-content-info dark:bg-background-info-dark dark:text-content-info-dark",
  InDevelopment:
    "bg-background-info text-content-info dark:bg-background-info-dark dark:text-content-info-dark",
  Complete:
    "bg-background-success text-content-success dark:bg-background-success-dark dark:text-content-success-dark",
  Solved:
    "bg-background-success text-content-success dark:bg-background-success-dark dark:text-content-success-dark",
  Live: "bg-background-error text-content-error dark:bg-background-error-dark dark:text-content-error-dark",
};

export function roadmapUrl(appBaseUrl?: string): string {
  if (!appBaseUrl) return "";
  return `${appBaseUrl}/strategy?view=roadmap`;
}
