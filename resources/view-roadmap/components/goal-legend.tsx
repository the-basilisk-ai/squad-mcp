import clsx from "clsx";
import type React from "react";
import { GOAL_COLOR, goalUrl } from "../constants";
import type { GoalSummary } from "../types";

export const GoalLegend: React.FC<{
  goals: GoalSummary[];
  appBaseUrl?: string;
}> = ({ goals, appBaseUrl }) => {
  if (goals.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {goals.map(goal => {
        const url = goalUrl(goal.id, appBaseUrl);
        const content = (
          <>
            <span className="truncate max-w-[200px]">{goal.title}</span>
            <span className="inline-flex gap-0.5 items-center ml-0.5">
              {[1, 2, 3, 4, 5].map(i => (
                <span
                  key={i}
                  className={clsx(
                    "size-[4px] rounded-[1px]",
                    GOAL_COLOR.dot,
                    i <= goal.priority ? "opacity-100" : "opacity-20",
                  )}
                />
              ))}
            </span>
          </>
        );

        const className = clsx(
          "inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md",
          GOAL_COLOR.bg,
          GOAL_COLOR.text,
        );

        return url ? (
          <a
            key={goal.id}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={goal.title}
            className={clsx(className, "no-underline hover:underline")}
          >
            {content}
          </a>
        ) : (
          <div key={goal.id} title={goal.title} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
};
