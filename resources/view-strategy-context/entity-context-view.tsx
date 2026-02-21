import type React from "react";
import { AncestorCard } from "./components/ancestor-card";
import { FocusedCard } from "./components/focused-card";
import { HierarchyNodeWrapper } from "./components/hierarchy-node-wrapper";
import { StackedChildren } from "./components/stacked-children";
import type { EntityContextProps } from "./types";

export const EntityContextView: React.FC<EntityContextProps> = ({
  ancestors,
  focused,
  children: childGroup,
  appBaseUrl,
}) => (
  <div className="text-gray-800 dark:text-zinc-100 p-2">
    <div className="flex flex-col">
      {ancestors.map((ancestor, i) => (
        <HierarchyNodeWrapper
          key={ancestor.id}
          type={ancestor.type}
          isAncestor
          showLine
          animationDelay={`${i * 0.05}s`}
        >
          <AncestorCard node={ancestor} appBaseUrl={appBaseUrl} />
        </HierarchyNodeWrapper>
      ))}
      <HierarchyNodeWrapper
        type={focused.type}
        isAncestor={false}
        showLine={!!childGroup?.count}
        animationDelay={`${ancestors.length * 0.05}s`}
      >
        <FocusedCard node={focused} appBaseUrl={appBaseUrl} />
      </HierarchyNodeWrapper>
    </div>
    {childGroup && childGroup.count > 0 && (
      <StackedChildren childGroup={childGroup} appBaseUrl={appBaseUrl} />
    )}
  </div>
);
