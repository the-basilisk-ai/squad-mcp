import clsx from "clsx";
import type React from "react";
import { TYPE_LABELS } from "../constants";
import { ENTITY_STYLES } from "../entity-styles";
import type { HierarchyNode } from "../types";
import { InsightBadge, PriorityBadge, StatusBadge } from "./badge";
import { EntityIcon } from "./icons";
import { LinkedTitle } from "./linked-title";
import { MiniStack } from "./mini-stack";

export const AncestorCard: React.FC<{
  node: HierarchyNode;
  appBaseUrl?: string;
}> = ({ node, appBaseUrl }) => {
  const styles = ENTITY_STYLES[node.type];

  const desc =
    node.type === "workspace" && node.missionStatement ? (
      <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1 line-clamp-2">
        {node.missionStatement}
      </div>
    ) : null;

  const hasMetaContent =
    node.status ||
    node.insightType ||
    (node.type === "opportunity" && node.insightCount);
  const meta = hasMetaContent ? (
    <div className="flex gap-2 flex-wrap">
      {node.status && <StatusBadge value={node.status} />}
      {node.insightType && (
        <StatusBadge value={node.insightType} title="Type" />
      )}
      <InsightBadge node={node} />
    </div>
  ) : null;

  const hasChildStack = !!(node.childCount && node.childType);

  const footer =
    hasChildStack && meta ? (
      <div className="flex items-center justify-between mt-1 gap-2">
        <MiniStack node={node} />
        {meta}
      </div>
    ) : meta ? (
      <div className="flex items-center justify-end mt-1 gap-2">{meta}</div>
    ) : hasChildStack ? (
      <MiniStack node={node} className="mt-1" />
    ) : null;

  return (
    <div
      className={clsx(
        "border border-gray-200 dark:border-zinc-700 rounded-[10px] bg-white dark:bg-zinc-900 border-l-2 px-3 py-2 mb-3",
        styles.accent,
      )}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <div
          className={clsx(
            "size-5 rounded-md flex items-center justify-center shrink-0 [&_svg]:size-3.5",
            styles.icon,
          )}
        >
          <EntityIcon type={node.type} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-400 dark:text-zinc-500">
          {TYPE_LABELS[node.type]}
        </span>
        <PriorityBadge node={node} />
      </div>
      <div className="text-[13px] font-medium text-gray-900 dark:text-white leading-[1.3]">
        <LinkedTitle
          title={node.title}
          type={node.type}
          id={node.id}
          appBaseUrl={appBaseUrl}
        />
      </div>
      {desc}
      {footer}
    </div>
  );
};
