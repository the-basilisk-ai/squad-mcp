import clsx from "clsx";
import type React from "react";
import { GOAL_COLORS } from "../constants";
import type { GoalSummary } from "../types";

export const GoalLegend: React.FC<{ goals: GoalSummary[] }> = ({ goals }) => {
  if (goals.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {goals.map((goal) => {
        const color = GOAL_COLORS[goal.colorIndex % GOAL_COLORS.length];
        return (
          <div
            key={goal.id}
            className={clsx(
              "inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md",
              color.bg,
              color.text,
            )}
          >
            <span
              className={clsx("size-2 rounded-full shrink-0", color.dot)}
            />
            <span className="truncate max-w-[140px]">{goal.title}</span>
            <span className="inline-flex gap-0.5 items-center ml-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className={clsx(
                    "size-[4px] rounded-[1px]",
                    color.dot,
                    i <= goal.priority ? "opacity-100" : "opacity-20",
                  )}
                />
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
};
