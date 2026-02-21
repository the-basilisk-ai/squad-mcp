import clsx from "clsx";
import type React from "react";
import { TYPE_LABELS, TYPE_PLURALS } from "../constants";
import { ENTITY_STYLES } from "../entity-styles";
import type { HierarchyNode } from "../types";

export const MiniStack: React.FC<{
  node: HierarchyNode;
  className?: string;
}> = ({ node, className }) => {
  if (!node.childCount || !node.childType) return null;

  const ct = node.childType;
  const n = node.childCount;
  const label = n === 1 ? TYPE_LABELS[ct] || ct : TYPE_PLURALS[ct] || `${ct}s`;
  const parentLabel = TYPE_LABELS[node.type] || node.type;
  const tooltip = `${n} ${label} for this ${parentLabel}`;
  const styles = ENTITY_STYLES[ct];

  return (
    <div
      className={clsx("inline-flex items-center gap-1 py-[3px]", className)}
      title={tooltip}
    >
      <div className="flex items-center relative h-[22px] min-w-[34px]">
        {n >= 3 && (
          <div
            className={clsx(
              "absolute h-[18px] w-7 left-1.5 top-1 rounded border opacity-30",
              styles.dot,
            )}
          />
        )}
        {n >= 2 && (
          <div
            className={clsx(
              "absolute h-[18px] w-7 left-[3px] top-0.5 rounded border opacity-50",
              styles.dot,
            )}
          />
        )}
        <div
          className={clsx(
            "absolute h-[18px] w-7 left-0 top-0 rounded border flex items-center justify-center text-[11px] font-bold z-[1]",
            styles.dot,
            styles.count,
          )}
        >
          {n}
        </div>
      </div>
      <span className="text-[11px] font-medium text-gray-500 dark:text-zinc-400 -mt-0.5">
        {label}
      </span>
    </div>
  );
};
