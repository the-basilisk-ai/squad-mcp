import clsx from "clsx";
import type React from "react";
import {
  ASSET_BASE,
  formatSource,
  SOURCES,
  STATUS_DISPLAY,
} from "../constants";
import { HORIZON_BADGE_CLASSES, STATUS_BADGE_CLASSES } from "../entity-styles";
import type { HierarchyNode } from "../types";
import { BoltIcon } from "./icons";

const badgeBase =
  "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md capitalize";

export const StatusBadge: React.FC<{
  value: string;
  title?: string;
}> = ({ value, title = "Status" }) => {
  const display = STATUS_DISPLAY[value] || value;
  const colors =
    STATUS_BADGE_CLASSES[value] ||
    "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span className={clsx(badgeBase, colors)} title={title}>
      {display}
    </span>
  );
};

export const HorizonBadge: React.FC<{ value: string }> = ({ value }) => {
  const colors =
    HORIZON_BADGE_CLASSES[value] ||
    "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span className={clsx(badgeBase, colors)} title="Roadmap Horizon">
      {value}
    </span>
  );
};

export const PriorityBadge: React.FC<{ node: HierarchyNode }> = ({ node }) => {
  if (node.type !== "goal" || !node.priority) return null;
  return (
    <span
      className="inline-flex items-center gap-[3px] text-[10px] font-semibold py-0.5 ml-auto text-content-warning dark:text-content-warning-dark"
      title={`Importance: ${node.priority}/5`}
    >
      <span className="inline-flex gap-0.5 items-center">
        {[1, 2, 3, 4, 5].map(i => (
          <span
            key={i}
            className={clsx(
              "size-[5px] rounded-[1.5px] bg-border-warning",
              i <= (node.priority ?? 0) ? "opacity-100" : "opacity-20",
            )}
          />
        ))}
      </span>
    </span>
  );
};

export const InsightBadge: React.FC<{ node: HierarchyNode }> = ({ node }) => {
  if (node.type !== "opportunity" || !node.insightCount) return null;
  const tip = `${node.insightCount} ${node.insightCount === 1 ? "Insight" : "Insights"}${node.hasUnseenInsights ? ", some unread" : ""}`;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-[3px] text-[11px] font-semibold px-1.5 py-0.5 rounded-md [&_svg]:size-3.5",
        node.hasUnseenInsights
          ? "bg-content-purple text-white dark:bg-content-purple-dark dark:text-zinc-900"
          : "border border-border-purple text-content-purple bg-white dark:bg-zinc-900 dark:text-content-purple-dark dark:border-background-purple-dark",
      )}
      title={tip}
    >
      <BoltIcon />
      {node.insightCount}
    </span>
  );
};

export const SourceBadge: React.FC<{ source: string }> = ({ source }) => {
  const info = SOURCES[source];
  const label = info ? info.label : formatSource(source);
  return (
    <span className="inline-flex items-stretch overflow-hidden rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 text-[10px] font-semibold capitalize">
      {info?.logo && (
        <span className="flex w-5">
          <img
            src={`${ASSET_BASE}${info.logo}`}
            alt=""
            className="w-full h-full object-cover"
          />
        </span>
      )}
      <span className="py-0.5 pr-[5px] pl-0.5">{label}</span>
    </span>
  );
};
