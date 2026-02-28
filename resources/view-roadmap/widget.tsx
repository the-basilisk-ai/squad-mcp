import { McpUseProvider, useWidget, type WidgetMetadata } from "mcp-use/react";
import type React from "react";
import { RoadmapView } from "./roadmap-view";
import { type RoadmapProps, propSchema } from "./types";
import "./styles.css";

export const widgetMetadata: WidgetMetadata = {
  description:
    "Visualise roadmap solutions organized by time horizon with goal context",
  props: propSchema,
  exposeAsTool: false,
  metadata: {
    prefersBorder: false,
    widgetDescription:
      "Shows solutions organized by time horizon (Now/Next/Later) with goal context and priority indicators.",
    invoking: "Loading roadmap...",
    invoked: "Roadmap ready",
  },
};

const RoadmapWidget: React.FC = () => {
  const { props, isPending } = useWidget<RoadmapProps>();

  if (isPending || !props.columns) {
    return (
      <div className="text-gray-800 dark:text-zinc-100 p-2">
        {/* Header skeleton */}
        <div className="flex items-baseline justify-between mb-3">
          <div className="shimmer h-4 w-20 rounded" />
          <div className="shimmer h-3 w-16 rounded" />
        </div>
        {/* Legend skeleton */}
        <div className="flex gap-2 mb-3">
          <div className="shimmer h-6 w-32 rounded-md" />
          <div className="shimmer h-6 w-28 rounded-md" />
        </div>
        {/* Column skeletons */}
        {[1, 2].map((i) => (
          <div key={i} className="mb-4">
            <div className="shimmer h-3 w-12 rounded mb-2" />
            <div className="shimmer h-14 rounded-lg mb-2" />
            <div className="shimmer h-14 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return <RoadmapView {...props} />;
};

const WrappedWidget: React.FC = () => (
  <McpUseProvider>
    <RoadmapWidget />
  </McpUseProvider>
);

export default WrappedWidget;
