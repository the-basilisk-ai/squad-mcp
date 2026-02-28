import clsx from "clsx";
import type React from "react";
import { GOAL_COLOR, STATUS_BADGE_CLASSES, STATUS_DISPLAY } from "../constants";
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
  goalMap: Map<string, GoalSummary>;
  appBaseUrl?: string;
}> = ({ solution, goalMap, appBaseUrl }) => {
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

  return (
    <div className="border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 px-3 py-2 animate-fade-in">
      <div className="text-[13px] font-semibold text-gray-900 dark:text-white leading-tight line-clamp-1">
        {titleEl}
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        <StatusBadge value={solution.status} />
        {goal && (
          <span
            className={clsx(
              "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md",
              GOAL_COLOR.bg,
              GOAL_COLOR.text,
            )}
          >
            <span
              className={clsx("size-1.5 rounded-full", GOAL_COLOR.dot)}
            />
            <span className="truncate max-w-[100px]">{goal.title}</span>
          </span>
        )}
      </div>
    </div>
  );
};
