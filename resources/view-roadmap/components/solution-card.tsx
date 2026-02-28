import clsx from "clsx";
import type React from "react";
import {
  GOAL_COLOR,
  HORIZON_BADGE_CLASSES,
  HORIZON_LABELS,
  STATUS_BADGE_CLASSES,
  STATUS_DISPLAY,
  goalUrl,
} from "../constants";
import type { GoalSummary, RoadmapSolution } from "../types";

const StatusBadge: React.FC<{ value: string }> = ({ value }) => {
  const display = STATUS_DISPLAY[value] || value;
  const colors =
    STATUS_BADGE_CLASSES[value] ||
    "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span
      className={clsx(
        "inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md capitalize",
        colors,
      )}
      title="Status"
    >
      {display}
    </span>
  );
};

export const SolutionCard: React.FC<{
  solution: RoadmapSolution;
  horizon: string;
  goalMap: Map<string, GoalSummary>;
  appBaseUrl?: string;
}> = ({ solution, horizon, goalMap, appBaseUrl }) => {
  const goal = solution.goalId ? goalMap.get(solution.goalId) : undefined;

  const url = appBaseUrl
    ? `${appBaseUrl}/strategy?p=solution&i=${encodeURIComponent(solution.id)}`
    : "";

  const titleEl = url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-inherit no-underline hover:underline"
    >
      {solution.title}
    </a>
  ) : (
    solution.title
  );

  const goalTag = goal ? (() => {
    const gUrl = goalUrl(goal.id, appBaseUrl);
    const inner = (
      <span className="truncate max-w-[200px]">{goal.title}</span>
    );
    const cls = clsx(
      "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md",
      GOAL_COLOR.bg,
      GOAL_COLOR.text,
    );
    return gUrl ? (
      <a
        href={gUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={goal.title}
        className={clsx(cls, "no-underline hover:underline")}
      >
        {inner}
      </a>
    ) : (
      <span className={cls} title={goal.title}>{inner}</span>
    );
  })() : null;

  return (
    <div className="border border-gray-200 dark:border-zinc-700 border-l-2 border-l-border-success rounded-[10px] bg-white dark:bg-zinc-900 px-3 py-2 animate-fade-in">
      <div className="flex items-center gap-1.5 mb-0.5">
        <div className="size-4 rounded-md flex items-center justify-center shrink-0 [&_svg]:size-3 bg-background-success text-content-success dark:bg-background-success-dark dark:text-content-success-dark">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M9 3.889c0-.273.188-.502.417-.65.355-.229.583-.587.583-.989C10 1.56 9.328 1 8.5 1S7 1.56 7 2.25c0 .41.237.774.603 1.002.22.137.397.355.397.613 0 .331-.275.596-.605.579-.744-.04-1.482-.1-2.214-.18a.75.75 0 0 0-.83.81c.067.764.111 1.535.133 2.312A.6.6 0 0 1 3.882 8c-.268 0-.495-.185-.64-.412C3.015 7.231 2.655 7 2.25 7 1.56 7 1 7.672 1 8.5S1.56 10 2.25 10c.404 0 .764-.23.993-.588.144-.227.37-.412.64-.412a.6.6 0 0 1 .601.614 39.338 39.338 0 0 1-.231 3.3.75.75 0 0 0 .661.829c.826.093 1.66.161 2.5.204A.56.56 0 0 0 8 13.386c0-.271-.187-.499-.415-.645C7.23 12.512 7 12.153 7 11.75c0-.69.672-1.25 1.5-1.25s1.5.56 1.5 1.25c0 .403-.23.762-.585.99-.228.147-.415.375-.415.646v.11c0 .278.223.504.5.504 1.196 0 2.381-.052 3.552-.154a.75.75 0 0 0 .68-.661c.135-1.177.22-2.37.253-3.574a.597.597 0 0 0-.6-.611c-.27 0-.498.187-.644.415-.229.356-.588.585-.991.585-.69 0-1.25-.672-1.25-1.5S11.06 7 11.75 7c.403 0 .762.23.99.585.147.228.375.415.646.415a.597.597 0 0 0 .599-.61 40.914 40.914 0 0 0-.132-2.365.75.75 0 0 0-.815-.684A39.51 39.51 0 0 1 9.5 4.5a.501.501 0 0 1-.5-.503v-.108Z" />
          </svg>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-400 dark:text-zinc-500">
          Solution
        </span>
      </div>
      <div className="text-[13px] font-semibold text-gray-900 dark:text-white leading-tight line-clamp-2">
        {titleEl}
      </div>
      <div className="flex items-center gap-1.5 mt-1 flex-wrap justify-between">
        {goalTag ?? <span />}
        <span className="inline-flex items-center gap-1.5">
          <StatusBadge value={solution.status} />
          <span
            className={clsx(
              "inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md capitalize",
              HORIZON_BADGE_CLASSES[horizon] ||
                "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300",
            )}
            title="Roadmap Horizon"
          >
            {HORIZON_LABELS[horizon] || horizon}
          </span>
        </span>
      </div>
    </div>
  );
};
