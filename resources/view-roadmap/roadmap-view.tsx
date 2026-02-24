import type React from "react";
import { useMemo } from "react";
import { GoalLegend } from "./components/goal-legend";
import { HorizonColumn } from "./components/horizon-column";
import { roadmapUrl } from "./constants";
import type { GoalSummary, RoadmapProps } from "./types";

export const RoadmapView: React.FC<RoadmapProps> = ({
  goals,
  columns,
  totalSolutions,
  appBaseUrl,
}) => {
  const goalMap = useMemo(
    () => new Map<string, GoalSummary>(goals.map((g) => [g.id, g])),
    [goals],
  );

  const url = roadmapUrl(appBaseUrl);

  return (
    <div className="text-gray-800 dark:text-zinc-100 p-2">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">
          Roadmap
        </h2>
        <span className="text-[11px] text-gray-400 dark:text-zinc-500">
          {totalSolutions} {totalSolutions === 1 ? "solution" : "solutions"}
        </span>
      </div>

      {/* Goal legend */}
      <GoalLegend goals={goals} />

      {/* Horizon columns */}
      {columns.length === 0 ? (
        <div className="text-center text-xs text-gray-400 dark:text-zinc-500 py-8">
          No solutions on the roadmap yet.
        </div>
      ) : (
        columns.map((column) => (
          <HorizonColumn
            key={column.horizon}
            column={column}
            goalMap={goalMap}
            appBaseUrl={appBaseUrl}
          />
        ))
      )}

      {/* Deep link */}
      {url && (
        <div className="mt-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
          >
            View in Squad
          </a>
        </div>
      )}
    </div>
  );
};
