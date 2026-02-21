import clsx from "clsx";
import type React from "react";
import { TYPE_LABELS } from "../constants";
import { ENTITY_STYLES } from "../entity-styles";
import type { HierarchyNode } from "../types";
import {
  HorizonBadge,
  InsightBadge,
  PriorityBadge,
  SourceBadge,
  StatusBadge,
} from "./badge";
import { EntityIcon } from "./icons";
import { LinkedTitle } from "./linked-title";

export const FocusedCard: React.FC<{
  node: HierarchyNode;
  appBaseUrl?: string;
}> = ({ node, appBaseUrl }) => {
  const styles = ENTITY_STYLES[node.type];
  const isRecommended = node.isRecommended;

  const descText = node.description || node.missionStatement;
  const desc = descText ? (
    <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1 line-clamp-2">
      {descText}
    </div>
  ) : null;

  const hasMetaContent =
    node.status ||
    node.horizon ||
    node.insightType ||
    node.source ||
    (node.type === "opportunity" && node.insightCount);

  const meta = hasMetaContent ? (
    <div className="flex gap-2 mt-2 flex-wrap justify-end">
      {node.status && <StatusBadge value={node.status} />}
      {node.horizon && <HorizonBadge value={node.horizon} />}
      {node.insightType && (
        <StatusBadge value={node.insightType} title="Type" />
      )}
      {node.source && <SourceBadge source={node.source} />}
      <InsightBadge node={node} />
    </div>
  ) : null;

  return (
    <div
      className={clsx(
        "rounded-[10px] bg-white dark:bg-zinc-900 px-3.5 py-3 mb-3 relative",
        isRecommended
          ? "border border-transparent shadow-md"
          : clsx("border border-transparent ring-2 shadow-md", styles.ring),
      )}
    >
      {isRecommended && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect
            x="1"
            y="1"
            rx="9"
            ry="9"
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
            strokeDasharray="10 6"
            style={{
              width: "calc(100% - 2px)",
              height: "calc(100% - 2px)",
            }}
          />
        </svg>
      )}
      <div className="flex items-center gap-2 mb-px">
        <div
          className={clsx(
            "size-5 rounded-md flex items-center justify-center shrink-0 [&_svg]:size-3.5",
            isRecommended
              ? "border-[1.5px] border-dashed border-border-success bg-transparent text-content-success dark:text-content-success-dark"
              : styles.icon,
          )}
        >
          <EntityIcon type={node.type} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-400 dark:text-zinc-500">
          {TYPE_LABELS[node.type]}
        </span>
        <PriorityBadge node={node} />
      </div>
      <div className="text-[15px] font-semibold text-gray-900 dark:text-white leading-[1.3]">
        <LinkedTitle
          title={node.title}
          type={node.type}
          id={node.id}
          appBaseUrl={appBaseUrl}
        />
      </div>
      {desc}
      {meta}
    </div>
  );
};
