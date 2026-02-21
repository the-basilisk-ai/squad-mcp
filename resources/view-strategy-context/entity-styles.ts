import type { EntityType } from "./types";

type StyleGroup = {
  dot: string;
  icon: string;
  accent: string;
  ring: string;
  stackBorder: string;
  count: string;
};

const purple: StyleGroup = {
  dot: "border-border-purple bg-background-purple dark:bg-background-purple-dark",
  icon: "bg-background-purple text-content-purple dark:bg-background-purple-dark dark:text-content-purple-dark",
  accent: "border-l-core-purple",
  ring: "ring-core-purple",
  stackBorder: "border-core-purple",
  count: "text-content-purple dark:text-content-purple-dark",
};

export const ENTITY_STYLES: Record<EntityType, StyleGroup> = {
  workspace: purple,
  goal: {
    dot: "border-border-warning bg-background-warning dark:bg-background-warning-dark",
    icon: "bg-background-warning text-content-warning dark:bg-background-warning-dark dark:text-content-warning-dark",
    accent: "border-l-border-warning",
    ring: "ring-border-warning",
    stackBorder: "border-border-warning",
    count: "text-content-warning dark:text-content-warning-dark",
  },
  opportunity: {
    dot: "border-border-info bg-background-info dark:bg-background-info-dark",
    icon: "bg-background-info text-content-info dark:bg-background-info-dark dark:text-content-info-dark",
    accent: "border-l-border-info",
    ring: "ring-border-info",
    stackBorder: "border-border-info",
    count: "text-content-info dark:text-content-info-dark",
  },
  solution: {
    dot: "border-border-success bg-background-success dark:bg-background-success-dark",
    icon: "bg-background-success text-content-success dark:bg-background-success-dark dark:text-content-success-dark",
    accent: "border-l-border-success",
    ring: "ring-border-success",
    stackBorder: "border-border-success",
    count: "text-content-success dark:text-content-success-dark",
  },
  insight: purple,
  feedback: {
    dot: "border-border-cyan bg-background-cyan dark:bg-background-cyan-dark",
    icon: "bg-background-cyan text-content-cyan dark:bg-background-cyan-dark dark:text-content-cyan-dark",
    accent: "border-l-border-cyan",
    ring: "ring-border-cyan",
    stackBorder: "border-border-cyan",
    count: "text-content-cyan dark:text-content-cyan-dark",
  },
};

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
  Bug: "bg-background-error text-content-error dark:bg-background-error-dark dark:text-content-error-dark",
  Feedback:
    "bg-background-cyan text-content-cyan dark:bg-background-cyan-dark dark:text-content-cyan-dark",
  FeatureRequest:
    "bg-background-purple text-content-purple dark:bg-background-purple-dark dark:text-content-purple-dark",
};

export const HORIZON_BADGE_CLASSES: Record<string, string> = {
  now: "bg-background-success text-content-success dark:bg-background-success-dark dark:text-content-success-dark",
  next: "bg-background-info text-content-info dark:bg-background-info-dark dark:text-content-info-dark",
  later: "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400",
};
