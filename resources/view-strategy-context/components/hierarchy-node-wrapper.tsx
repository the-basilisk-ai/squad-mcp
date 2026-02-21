import clsx from "clsx";
import type React from "react";
import { ENTITY_STYLES } from "../entity-styles";
import type { EntityType } from "../types";

export const HierarchyNodeWrapper: React.FC<{
  type: EntityType;
  isAncestor: boolean;
  showLine: boolean;
  linePosition?: "below" | "above";
  animationDelay?: string;
  children: React.ReactNode;
}> = ({
  type,
  isAncestor,
  showLine,
  linePosition = "below",
  animationDelay,
  children,
}) => (
  <div
    className="relative pl-7 animate-fade-in"
    style={animationDelay ? { animationDelay } : undefined}
  >
    {showLine &&
      (linePosition === "below" ? (
        <div className="absolute left-[11px] top-9 bottom-[-8px] w-0.5 bg-gray-200 dark:bg-zinc-700 opacity-40" />
      ) : (
        <div className="absolute left-[11px] top-[-8px] h-4 w-0.5 bg-gray-200 dark:bg-zinc-700 opacity-40" />
      ))}
    <div
      className={clsx(
        "absolute left-[7px] top-[14px] size-2.5 rounded-full border-2 z-10",
        ENTITY_STYLES[type].dot,
        isAncestor && "opacity-40",
      )}
    />
    {children}
  </div>
);
