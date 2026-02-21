import clsx from "clsx";
import type React from "react";
import {
  getStatusColor,
  STATUS_DISPLAY,
  TYPE_LABELS,
  TYPE_PLURALS,
} from "../constants";
import { ENTITY_STYLES } from "../entity-styles";
import type { ChildGroup } from "../types";
import { HierarchyNodeWrapper } from "./hierarchy-node-wrapper";
import { EntityIcon } from "./icons";
import { LinkedTitle } from "./linked-title";

export const StackedChildren: React.FC<{
  childGroup: ChildGroup;
  appBaseUrl?: string;
}> = ({ childGroup: children, appBaseUrl }) => {
  if (children.count === 0) return null;

  const isDark =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches;

  const styles = ENTITY_STYLES[children.type];
  const showing = Math.min(children.items.length, 4);
  const label =
    children.count !== 1
      ? TYPE_PLURALS[children.type] || `${children.type}s`
      : TYPE_LABELS[children.type] || children.type;

  return (
    <HierarchyNodeWrapper
      type={children.type}
      isAncestor
      showLine
      linePosition="above"
      animationDelay="0.25s"
    >
      <div className="relative mb-1.5">
        {children.count >= 3 && (
          <div
            className={clsx(
              "absolute inset-x-0 h-full rounded-[10px] border bg-white dark:bg-zinc-900 top-1.5 opacity-40",
              styles.stackBorder,
            )}
          />
        )}
        {children.count >= 2 && (
          <div
            className={clsx(
              "absolute inset-x-0 h-full rounded-[10px] border bg-white dark:bg-zinc-900 top-[3px] opacity-70",
              styles.stackBorder,
            )}
          />
        )}
        <div
          className={clsx(
            "relative z-[2] rounded-[10px] border bg-white dark:bg-zinc-900 px-3.5 py-3 flex flex-col gap-0.5",
            styles.stackBorder,
          )}
        >
          <div className="flex items-start gap-2.5">
            <div
              className={clsx(
                "size-5 rounded-md flex items-center justify-center shrink-0 [&_svg]:size-3.5",
                styles.icon,
              )}
            >
              <EntityIcon type={children.type} />
            </div>
            <div className="text-xs font-medium text-gray-600 dark:text-zinc-400 flex items-baseline gap-1">
              <span
                className={clsx("text-xl font-bold leading-none", styles.count)}
              >
                {children.count}
              </span>
              <span>{label}</span>
            </div>
          </div>
          {children.items.length > 0 && (
            <div className="flex flex-col gap-0.5 mt-0.5">
              {children.items.slice(0, showing).map(item => {
                const dotColor = getStatusColor(item.status, isDark);
                const statusLabel =
                  STATUS_DISPLAY[item.status || ""] || item.status || "Unknown";
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-zinc-400"
                    title={statusLabel}
                  >
                    <span
                      className="size-1.5 rounded-full shrink-0"
                      style={{ background: dotColor }}
                    />
                    <LinkedTitle
                      title={item.title}
                      type={children.type}
                      id={item.id}
                      appBaseUrl={appBaseUrl}
                    />
                  </div>
                );
              })}
              {children.count > showing && (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-zinc-500">
                  + {children.count - showing} more
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </HierarchyNodeWrapper>
  );
};
