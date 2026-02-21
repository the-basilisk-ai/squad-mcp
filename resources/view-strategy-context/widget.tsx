import { McpUseProvider, useWidget, type WidgetMetadata } from "mcp-use/react";
import type React from "react";
import { EntityContextView } from "./entity-context-view";
import { type EntityContextProps, propSchema } from "./types";
import "./styles.css";

export const widgetMetadata: WidgetMetadata = {
  description: "Visualise any entity in its product strategy tree hierarchy",
  props: propSchema,
  exposeAsTool: false,
  metadata: {
    prefersBorder: false,
    invoking: "Loading entity context...",
    invoked: "Entity context ready",
    csp: {
      resourceDomains: ["https://assets.meetsquad.ai"],
    },
  },
};

const EntityContextWidget: React.FC = () => {
  const { props, isPending } = useWidget<EntityContextProps>();

  if (isPending || !props.focused) {
    const skeletonMap: Record<
      string,
      { ancestors: number; children: boolean }
    > = {
      workspace: { ancestors: 0, children: true },
      goal: { ancestors: 1, children: true },
      opportunity: { ancestors: 2, children: true },
      solution: { ancestors: 3, children: true },
      insight: { ancestors: 4, children: false },
      feedback: { ancestors: 4, children: false },
    };
    const hint = skeletonMap[props.focused?.type ?? "goal"];

    return (
      <div className="text-gray-800 dark:text-zinc-100 p-2">
        <div className="flex flex-col">
          {Array.from({ length: hint.ancestors }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
            <div className="relative pl-7" key={i}>
              {/* Connector line */}
              <div className="absolute left-[11px] top-9 bottom-[-8px] w-0.5 bg-gray-200 dark:bg-zinc-700 opacity-40" />
              {/* Connector dot */}
              <div className="absolute left-[7px] top-[14px] size-2.5 rounded-full border-2 border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 z-10 opacity-40" />
              <div className="border border-gray-200 dark:border-zinc-700 rounded-[10px] bg-white dark:bg-zinc-900 mb-3 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="shimmer size-5 rounded-md shrink-0" />
                  <div className="shimmer h-2.5" style={{ width: "30%" }} />
                </div>
                <div
                  className="shimmer h-3.5 mt-1.5"
                  style={{ width: "55%" }}
                />
                <div className="shimmer h-3 mt-1.5" style={{ width: "90%" }} />
                <div className="shimmer h-3 mt-1" style={{ width: "60%" }} />
                <div className="shimmer h-[18px] w-16 rounded mt-2" />
              </div>
            </div>
          ))}
          {/* Focused card skeleton */}
          <div className="relative pl-7">
            {/* Connector line (only if children) */}
            {hint.children && (
              <div className="absolute left-[11px] top-9 bottom-[-8px] w-0.5 bg-gray-200 dark:bg-zinc-700 opacity-40" />
            )}
            {/* Connector dot */}
            <div className="absolute left-[7px] top-[14px] size-2.5 rounded-full border-2 border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 z-10" />
            <div className="border border-gray-200 dark:border-zinc-700 rounded-[10px] bg-white dark:bg-zinc-900 mb-3 px-3.5 py-3 min-h-[92px]">
              <div className="flex items-center gap-2">
                <div className="shimmer size-5 rounded-md shrink-0" />
                <div className="shimmer h-3.5" style={{ width: "60%" }} />
              </div>
              <div className="shimmer h-3.5 mt-2" style={{ width: "80%" }} />
              <div className="flex gap-2 mt-2">
                <div className="shimmer h-[18px] w-14 rounded-md" />
                <div className="shimmer h-[18px] w-11 rounded-md" />
              </div>
            </div>
          </div>
        </div>
        {hint.children && (
          <div className="relative pl-7">
            {/* Upward connector line */}
            <div className="absolute left-[11px] top-[-8px] h-4 w-0.5 bg-gray-200 dark:bg-zinc-700 opacity-40" />
            {/* Connector dot */}
            <div className="absolute left-[7px] top-[14px] size-2.5 rounded-full border-2 border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 z-10 opacity-40" />
            <div className="relative mb-1.5">
              <div className="absolute inset-x-0 h-full rounded-[10px] border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 top-1.5 opacity-40" />
              <div className="absolute inset-x-0 h-full rounded-[10px] border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 top-[3px] opacity-70" />
              <div className="relative z-[2] border border-gray-200 dark:border-zinc-700 rounded-[10px] bg-white dark:bg-zinc-900 px-3.5 py-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="shimmer size-5 rounded-md shrink-0" />
                  <div className="shimmer h-3.5" style={{ width: "30%" }} />
                </div>
                {Array.from({ length: 3 }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
                  <div className="flex items-center gap-1.5" key={i}>
                    <div className="shimmer size-1.5 rounded-full shrink-0" />
                    <div
                      className="shimmer h-3.5"
                      style={{ width: `${60 - i * 10}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return <EntityContextView {...props} />;
};

const WrappedWidget: React.FC = () => (
  <McpUseProvider>
    <EntityContextWidget />
  </McpUseProvider>
);

export default WrappedWidget;
