import type { Meta, StoryObj } from "@storybook/react";
import { EntityContextView } from "./entity-context-view";
import type { EntityContextProps, HierarchyNode } from "./types";

const APP_BASE_URL =
  "https://app.meetsquad.ai/968c8ded-e944-4d10-bc35-9415ba89aa53/063e716e-65c4-4988-9cca-8fd109a81ab8";

// ── Reusable ancestor nodes ─────────────────────────────────────────

const WORKSPACE_ANCESTOR: HierarchyNode = {
  id: "ws-1",
  type: "workspace",
  title: "Squad AI",
  missionStatement:
    "To democratize product management by providing AI-driven tools that help teams build better products.",
  childCount: 3,
  childType: "goal",
};

const GOAL_ANCESTOR: HierarchyNode = {
  id: "g-1",
  type: "goal",
  title: "Accelerate Market Penetration in Enterprise Segment",
  priority: 3,
  childCount: 5,
  childType: "opportunity",
};

const OPPORTUNITY_ANCESTOR: HierarchyNode = {
  id: "o-1",
  type: "opportunity",
  title: "Enterprise CRM Integration Gap",
  status: "InProgress",
  insightCount: 3,
  hasUnseenInsights: true,
  childCount: 3,
  childType: "solution",
};

const INSIGHT_ANCESTOR: HierarchyNode = {
  id: "i-1",
  type: "insight",
  title: "Users need native Salesforce integration for pipeline visibility",
  insightType: "FeatureRequest",
};

// ── Meta ────────────────────────────────────────────────────────────

const meta: Meta<typeof EntityContextView> = {
  title: "Widgets/EntityContext",
  component: EntityContextView,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof EntityContextView>;

// ── Workspace ───────────────────────────────────────────────────────

export const Workspace: Story = {
  args: {
    ancestors: [],
    focused: {
      id: "ws-1",
      type: "workspace",
      title: "Squad AI",
      description:
        "AI-driven product management platform helping teams build better products through intelligent insights.",
      missionStatement:
        "To democratize product management by providing AI-driven tools that help teams build better products.",
    },
    children: {
      type: "goal",
      count: 3,
      items: [
        {
          id: "g-1",
          title: "Accelerate Market Penetration in Enterprise Segment",
        },
        { id: "g-2", title: "Improve User Retention and Engagement" },
        { id: "g-3", title: "Expand Platform Integration Ecosystem" },
      ],
    },
    appBaseUrl: APP_BASE_URL,
  } satisfies EntityContextProps,
};

export const WorkspaceNoChildren: Story = {
  args: {
    ancestors: [],
    focused: {
      id: "ws-1",
      type: "workspace",
      title: "Squad AI",
      description:
        "AI-driven product management platform helping teams build better products through intelligent insights.",
      missionStatement:
        "To democratize product management by providing AI-driven tools that help teams build better products.",
    },
    children: null,
    appBaseUrl: APP_BASE_URL,
  } satisfies EntityContextProps,
};

// ── Goal ────────────────────────────────────────────────────────────

export const Goal: Story = {
  args: {
    ancestors: [WORKSPACE_ANCESTOR],
    focused: {
      id: "g-1",
      type: "goal",
      title: "Accelerate Market Penetration in Enterprise Segment",
      description:
        "Drive adoption of Squad AI within large enterprise organizations by addressing their specific needs.",
      priority: 5,
    },
    children: {
      type: "opportunity",
      count: 12,
      items: [
        {
          id: "o-1",
          title: "Enterprise CRM Integration Gap",
          status: "InProgress",
        },
        {
          id: "o-2",
          title: "Regulatory Compliance Automation",
          status: "New",
        },
        {
          id: "o-3",
          title: "Multi-Knowledge Base Platform",
          status: "Planned",
        },
        {
          id: "o-4",
          title: "Advanced AI Agent Customization",
          status: "New",
        },
      ],
    },
    appBaseUrl: APP_BASE_URL,
  } satisfies EntityContextProps,
};

export const GoalNoChildren: Story = {
  args: {
    ancestors: [WORKSPACE_ANCESTOR],
    focused: {
      id: "g-1",
      type: "goal",
      title: "Accelerate Market Penetration in Enterprise Segment",
      description:
        "Drive adoption of Squad AI within large enterprise organizations by addressing their specific needs.",
      priority: 5,
    },
    children: null,
    appBaseUrl: APP_BASE_URL,
  } satisfies EntityContextProps,
};

export const GoalNoAncestors: Story = {
  args: {
    ancestors: [],
    focused: {
      id: "g-1",
      type: "goal",
      title: "Accelerate Market Penetration in Enterprise Segment",
      description:
        "Drive adoption of Squad AI within large enterprise organizations by addressing their specific needs.",
      priority: 5,
    },
    children: {
      type: "opportunity",
      count: 12,
      items: [
        {
          id: "o-1",
          title: "Enterprise CRM Integration Gap",
          status: "InProgress",
        },
        {
          id: "o-2",
          title: "Regulatory Compliance Automation",
          status: "New",
        },
        {
          id: "o-3",
          title: "Multi-Knowledge Base Platform",
          status: "Planned",
        },
        {
          id: "o-4",
          title: "Advanced AI Agent Customization",
          status: "New",
        },
      ],
    },
    appBaseUrl: APP_BASE_URL,
  } satisfies EntityContextProps,
};

// ── Opportunity ─────────────────────────────────────────────────────

export const Opportunity: Story = {
  args: {
    ancestors: [WORKSPACE_ANCESTOR, GOAL_ANCESTOR],
    focused: {
      id: "o-1",
      type: "opportunity",
      title: "Enterprise CRM Integration Gap",
      description:
        "Large enterprise customers need seamless CRM integration to consolidate sales pipeline data with product insights.",
      status: "InProgress",
      insightCount: 3,
      hasUnseenInsights: true,
    },
    children: {
      type: "solution",
      count: 6,
      items: [
        { id: "s-1", title: "CRM Intelligence Bridge", status: "New" },
        { id: "s-2", title: "Enterprise Workflow Fabric", status: "New" },
        {
          id: "s-3",
          title: "Salesforce Connector Plugin",
          status: "InProgress",
        },
        { id: "s-4", title: "HubSpot Data Sync Module", status: "Planned" },
      ],
    },
    appBaseUrl: APP_BASE_URL,
  } satisfies EntityContextProps,
};

export const OpportunityNoChildren: Story = {
  args: {
    ancestors: [WORKSPACE_ANCESTOR, GOAL_ANCESTOR],
    focused: {
      id: "o-1",
      type: "opportunity",
      title: "Enterprise CRM Integration Gap",
      description:
        "Large enterprise customers need seamless CRM integration to consolidate sales pipeline data with product insights.",
      status: "InProgress",
      insightCount: 3,
      hasUnseenInsights: true,
    },
    children: null,
    appBaseUrl: APP_BASE_URL,
  } satisfies EntityContextProps,
};

export const OpportunityNoAncestors: Story = {
  args: {
    ancestors: [],
    focused: {
      id: "o-1",
      type: "opportunity",
      title: "Enterprise CRM Integration Gap",
      description:
        "Large enterprise customers need seamless CRM integration to consolidate sales pipeline data with product insights.",
      status: "InProgress",
      insightCount: 3,
      hasUnseenInsights: true,
    },
    children: {
      type: "solution",
      count: 6,
      items: [
        { id: "s-1", title: "CRM Intelligence Bridge", status: "New" },
        { id: "s-2", title: "Enterprise Workflow Fabric", status: "New" },
        {
          id: "s-3",
          title: "Salesforce Connector Plugin",
          status: "InProgress",
        },
        { id: "s-4", title: "HubSpot Data Sync Module", status: "Planned" },
      ],
    },
    appBaseUrl: APP_BASE_URL,
  } satisfies EntityContextProps,
};

// ── Solution ────────────────────────────────────────────────────────

export const Solution: Story = {
  args: {
    ancestors: [WORKSPACE_ANCESTOR, GOAL_ANCESTOR, OPPORTUNITY_ANCESTOR],
    focused: {
      id: "s-1",
      type: "solution",
      title: "CRM Intelligence Bridge",
      description:
        "Bidirectional sync between Squad and enterprise CRM platforms, enabling automatic opportunity discovery from sales pipeline data.",
      status: "New",
      horizon: "next",
    },
    children: null,
    appBaseUrl: APP_BASE_URL,
  } satisfies EntityContextProps,
};

export const SolutionRecommended: Story = {
  args: {
    ancestors: [WORKSPACE_ANCESTOR, GOAL_ANCESTOR, OPPORTUNITY_ANCESTOR],
    focused: {
      id: "s-2",
      type: "solution",
      title: "Enterprise Workflow Fabric",
      description:
        "AI-generated solution for automating cross-platform workflow orchestration in enterprise environments.",
      status: "New",
      isRecommended: true,
    },
    children: null,
    appBaseUrl: APP_BASE_URL,
  } satisfies EntityContextProps,
};

export const SolutionNoAncestors: Story = {
  args: {
    ancestors: [],
    focused: {
      id: "s-1",
      type: "solution",
      title: "CRM Intelligence Bridge",
      description:
        "Bidirectional sync between Squad and enterprise CRM platforms, enabling automatic opportunity discovery from sales pipeline data.",
      status: "New",
      horizon: "next",
    },
    children: null,
    appBaseUrl: APP_BASE_URL,
  } satisfies EntityContextProps,
};

// ── Insight ─────────────────────────────────────────────────────────

export const Insight: Story = {
  args: {
    ancestors: [WORKSPACE_ANCESTOR, GOAL_ANCESTOR, OPPORTUNITY_ANCESTOR],
    focused: {
      id: "i-1",
      type: "insight",
      title: "Users need native Salesforce integration for pipeline visibility",
      description:
        "Multiple enterprise customers have requested direct Salesforce integration to consolidate sales pipeline data with product insights without manual CSV exports.",
      insightType: "FeatureRequest",
    },
    children: {
      type: "feedback",
      count: 14,
      items: [],
    },
    appBaseUrl: APP_BASE_URL,
  } satisfies EntityContextProps,
};

export const InsightNoChildren: Story = {
  args: {
    ancestors: [WORKSPACE_ANCESTOR, GOAL_ANCESTOR, OPPORTUNITY_ANCESTOR],
    focused: {
      id: "i-1",
      type: "insight",
      title: "Users need native Salesforce integration for pipeline visibility",
      description:
        "Multiple enterprise customers have requested direct Salesforce integration to consolidate sales pipeline data with product insights without manual CSV exports.",
      insightType: "FeatureRequest",
    },
    children: null,
    appBaseUrl: APP_BASE_URL,
  } satisfies EntityContextProps,
};

export const InsightNoAncestors: Story = {
  args: {
    ancestors: [],
    focused: {
      id: "i-1",
      type: "insight",
      title: "Users need native Salesforce integration for pipeline visibility",
      description:
        "Multiple enterprise customers have requested direct Salesforce integration to consolidate sales pipeline data with product insights without manual CSV exports.",
      insightType: "FeatureRequest",
    },
    children: {
      type: "feedback",
      count: 14,
      items: [],
    },
    appBaseUrl: APP_BASE_URL,
  } satisfies EntityContextProps,
};

// ── Feedback ────────────────────────────────────────────────────────

export const Feedback: Story = {
  args: {
    ancestors: [
      WORKSPACE_ANCESTOR,
      GOAL_ANCESTOR,
      { ...OPPORTUNITY_ANCESTOR, childCount: undefined, childType: undefined },
      INSIGHT_ANCESTOR,
    ],
    focused: {
      id: "f-1",
      type: "feedback",
      title:
        "We spend hours every week manually exporting Salesforce pipeline data into\u2026",
      description:
        "We spend hours every week manually exporting Salesforce pipeline data into your tool. It would save our team so much time if there was a direct integration. We've been asking about this for months and it's becoming a blocker for renewal.",
      source: "GONG",
    },
    children: null,
    appBaseUrl: APP_BASE_URL,
  } satisfies EntityContextProps,
};

export const FeedbackNoAncestors: Story = {
  args: {
    ancestors: [],
    focused: {
      id: "f-1",
      type: "feedback",
      title:
        "We spend hours every week manually exporting Salesforce pipeline data into\u2026",
      description:
        "We spend hours every week manually exporting Salesforce pipeline data into your tool. It would save our team so much time if there was a direct integration. We've been asking about this for months and it's becoming a blocker for renewal.",
      source: "GONG",
    },
    children: null,
    appBaseUrl: APP_BASE_URL,
  } satisfies EntityContextProps,
};
