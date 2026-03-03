import clsx from "clsx";
import type React from "react";
import { HORIZON_HEADER_STYLES, HORIZON_LABELS } from "../constants";
import type { GoalSummary, HorizonColumn as HorizonColumnType } from "../types";
import { SolutionCard } from "./solution-card";

export const HorizonColumn: React.FC<{
  column: HorizonColumnType;
  goalMap: Map<string, GoalSummary>;
  appBaseUrl?: string;
}> = ({ column, goalMap, appBaseUrl }) => (
  <div className="mb-4 last:mb-0">
    <div
      className={clsx(
        "flex items-center gap-2 mb-2 pb-1 border-b",
        HORIZON_HEADER_STYLES[column.horizon],
      )}
    >
      <span className="text-xs font-bold uppercase tracking-wide">
        {HORIZON_LABELS[column.horizon] || column.horizon}
      </span>
      <span className="text-[10px] opacity-60">
        ({column.solutions.length})
      </span>
    </div>
    <div className="flex flex-col gap-2">
      {column.solutions.map(solution => (
        <SolutionCard
          key={solution.id}
          solution={solution}
          horizon={column.horizon}
          goalMap={goalMap}
          appBaseUrl={appBaseUrl}
        />
      ))}
    </div>
  </div>
);
