import type React from "react";
import { useMemo } from "react";
import { ExternalLink } from "../shared/external-link";
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
    () => new Map<string, GoalSummary>(goals.map(g => [g.id, g])),
    [goals],
  );

  const url = roadmapUrl(appBaseUrl);

  return (
    <div className="text-gray-800 dark:text-zinc-100 p-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="size-4"
          >
            <path
              fillRule="evenodd"
              d="M8.161 2.58a1.875 1.875 0 0 1 1.678 0l4.993 2.498c.106.052.23.052.336 0l3.869-1.935A1.875 1.875 0 0 1 21.75 4.82v12.485c0 .71-.401 1.36-1.037 1.677l-4.875 2.437a1.875 1.875 0 0 1-1.676 0l-4.994-2.497a.375.375 0 0 0-.336 0l-3.868 1.935A1.875 1.875 0 0 1 2.25 19.18V6.695c0-.71.401-1.36 1.036-1.677l4.875-2.437ZM9 6a.75.75 0 0 1 .75.75V15a.75.75 0 0 1-1.5 0V6.75A.75.75 0 0 1 9 6Zm6.75 3a.75.75 0 0 0-1.5 0v8.25a.75.75 0 0 0 1.5 0V9Z"
              clipRule="evenodd"
            />
          </svg>
          {url ? (
            <ExternalLink
              href={url}
              className="text-inherit no-underline hover:underline"
            >
              Roadmap
            </ExternalLink>
          ) : (
            "Roadmap"
          )}
        </h2>
        <span className="text-[11px] text-gray-400 dark:text-zinc-500">
          {totalSolutions} {totalSolutions === 1 ? "solution" : "solutions"}
        </span>
      </div>

      {/* Goal legend */}
      <GoalLegend goals={goals} appBaseUrl={appBaseUrl} />

      {/* Horizon columns */}
      {columns.length === 0 ? (
        <div className="text-center text-xs text-gray-400 dark:text-zinc-500 py-8">
          No solutions on the roadmap yet.
        </div>
      ) : (
        columns.map(column => (
          <HorizonColumn
            key={column.horizon}
            column={column}
            goalMap={goalMap}
            appBaseUrl={appBaseUrl}
          />
        ))
      )}
    </div>
  );
};
