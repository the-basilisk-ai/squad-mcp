import type { Meta, StoryObj } from "@storybook/react";
import { RoadmapView } from "./roadmap-view";
import type { RoadmapProps } from "./types";

const APP_BASE_URL =
  "https://app.meetsquad.ai/968c8ded-e944-4d10-bc35-9415ba89aa53/063e716e-65c4-4988-9cca-8fd109a81ab8";

const meta: Meta<typeof RoadmapView> = {
  title: "Widgets/Roadmap",
  component: RoadmapView,
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof RoadmapView>;

export const FullRoadmap: Story = {
  args: {
    goals: [
      {
        id: "g-1",
        title: "Accelerate Market Penetration",
        priority: 5,
      },
      {
        id: "g-2",
        title: "AI Innovation",
        priority: 3,
      },
    ],
    columns: [
      {
        horizon: "now",
        solutions: [
          {
            id: "s-1",
            title: "Compliance Validator",
            status: "InDevelopment",
            goalId: "g-1",
          },
          {
            id: "s-2",
            title: "Unified Segmentation Engine",
            status: "New",
            goalId: "g-1",
          },
        ],
      },
      {
        horizon: "next",
        solutions: [
          {
            id: "s-3",
            title: "CRM Intelligence Bridge",
            status: "Planned",
            goalId: "g-2",
          },
          {
            id: "s-4",
            title: "Enterprise Workflow Fabric",
            status: "Planned",
            goalId: "g-2",
          },
          {
            id: "s-5",
            title: "Customer Health Dashboard",
            status: "New",
            goalId: "g-1",
          },
        ],
      },
    ],
    totalSolutions: 5,
    appBaseUrl: APP_BASE_URL,
  } satisfies RoadmapProps,
};

export const SingleGoalFiltered: Story = {
  args: {
    goals: [
      {
        id: "g-1",
        title: "Accelerate Market Penetration",
        priority: 5,
      },
    ],
    columns: [
      {
        horizon: "now",
        solutions: [
          {
            id: "s-1",
            title: "Compliance Validator",
            status: "InDevelopment",
            goalId: "g-1",
          },
        ],
      },
      {
        horizon: "later",
        solutions: [
          {
            id: "s-6",
            title: "Market Analytics Suite",
            status: "Backlog",
            goalId: "g-1",
          },
        ],
      },
    ],
    totalSolutions: 2,
    appBaseUrl: APP_BASE_URL,
  } satisfies RoadmapProps,
};

export const EmptyRoadmap: Story = {
  args: {
    goals: [],
    columns: [],
    totalSolutions: 0,
    appBaseUrl: APP_BASE_URL,
  } satisfies RoadmapProps,
};

export const ManyGoals: Story = {
  args: {
    goals: [
      {
        id: "g-1",
        title: "Accelerate Market Penetration",
        priority: 5,
      },
      { id: "g-2", title: "AI Innovation", priority: 3 },
      { id: "g-3", title: "Customer Retention", priority: 4 },
      { id: "g-4", title: "Platform Reliability", priority: 2 },
      {
        id: "g-5",
        title: "Developer Experience",
        priority: 1,
      },
    ],
    columns: [
      {
        horizon: "now",
        solutions: [
          {
            id: "s-1",
            title: "Compliance Validator",
            status: "InDevelopment",
            goalId: "g-1",
          },
          {
            id: "s-2",
            title: "AI Agent Framework",
            status: "InDevelopment",
            goalId: "g-2",
          },
        ],
      },
      {
        horizon: "next",
        solutions: [
          {
            id: "s-3",
            title: "Churn Predictor",
            status: "Planned",
            goalId: "g-3",
          },
          {
            id: "s-4",
            title: "Infra Monitoring Suite",
            status: "New",
            goalId: "g-4",
          },
        ],
      },
      {
        horizon: "later",
        solutions: [
          { id: "s-5", title: "SDK v3", status: "Backlog", goalId: "g-5" },
          {
            id: "s-6",
            title: "Self-serve Onboarding",
            status: "Backlog",
            goalId: "g-3",
          },
        ],
      },
    ],
    totalSolutions: 6,
    appBaseUrl: APP_BASE_URL,
  } satisfies RoadmapProps,
};

export const AllStatuses: Story = {
  args: {
    goals: [{ id: "g-1", title: "Ship Everything", priority: 5 }],
    columns: [
      {
        horizon: "now",
        solutions: [
          { id: "s-1", title: "New Feature", status: "New", goalId: "g-1" },
          {
            id: "s-2",
            title: "In Progress Task",
            status: "InProgress",
            goalId: "g-1",
          },
          {
            id: "s-3",
            title: "Dev Build",
            status: "InDevelopment",
            goalId: "g-1",
          },
        ],
      },
      {
        horizon: "next",
        solutions: [
          {
            id: "s-4",
            title: "Planned Work",
            status: "Planned",
            goalId: "g-1",
          },
          {
            id: "s-5",
            title: "Completed Item",
            status: "Complete",
            goalId: "g-1",
          },
          { id: "s-6", title: "Solved Issue", status: "Solved", goalId: "g-1" },
        ],
      },
      {
        horizon: "later",
        solutions: [
          { id: "s-7", title: "Live Service", status: "Live", goalId: "g-1" },
          {
            id: "s-8",
            title: "Cancelled Project",
            status: "Cancelled",
            goalId: "g-1",
          },
          {
            id: "s-9",
            title: "Backlog Item",
            status: "Backlog",
            goalId: "g-1",
          },
        ],
      },
    ],
    totalSolutions: 9,
    appBaseUrl: APP_BASE_URL,
  } satisfies RoadmapProps,
};

export const SolutionsWithoutGoals: Story = {
  args: {
    goals: [],
    columns: [
      {
        horizon: "now",
        solutions: [
          { id: "s-1", title: "Orphan Task A", status: "InProgress" },
          { id: "s-2", title: "Orphan Task B", status: "New" },
        ],
      },
      {
        horizon: "next",
        solutions: [{ id: "s-3", title: "Orphan Task C", status: "Planned" }],
      },
    ],
    totalSolutions: 3,
    appBaseUrl: APP_BASE_URL,
  } satisfies RoadmapProps,
};

export const OneSolution: Story = {
  args: {
    goals: [{ id: "g-1", title: "Quick Win", priority: 3 }],
    columns: [
      {
        horizon: "now",
        solutions: [
          { id: "s-1", title: "Bug Fix", status: "InProgress", goalId: "g-1" },
        ],
      },
    ],
    totalSolutions: 1,
    appBaseUrl: APP_BASE_URL,
  } satisfies RoadmapProps,
};

export const LongTitles: Story = {
  args: {
    goals: [
      {
        id: "g-1",
        title:
          "Improve Cross-Functional Alignment Across All Product Teams and Stakeholders",
        priority: 5,
      },
      {
        id: "g-2",
        title:
          "Achieve Enterprise-Grade Security Compliance for SOC2 and ISO 27001 Certification",
        priority: 4,
      },
    ],
    columns: [
      {
        horizon: "now",
        solutions: [
          {
            id: "s-1",
            title:
              "Build a Comprehensive Real-Time Analytics Dashboard with Advanced Filtering and Export Capabilities",
            status: "InDevelopment",
            goalId: "g-1",
          },
        ],
      },
      {
        horizon: "next",
        solutions: [
          {
            id: "s-2",
            title:
              "Implement Multi-Tenant Role-Based Access Control with Fine-Grained Permission Management",
            status: "Planned",
            goalId: "g-2",
          },
        ],
      },
    ],
    totalSolutions: 2,
    appBaseUrl: APP_BASE_URL,
  } satisfies RoadmapProps,
};

export const LaterOnly: Story = {
  args: {
    goals: [{ id: "g-1", title: "Future Vision", priority: 2 }],
    columns: [
      {
        horizon: "later",
        solutions: [
          { id: "s-1", title: "V3 Rewrite", status: "Backlog", goalId: "g-1" },
          { id: "s-2", title: "Mobile App", status: "Backlog", goalId: "g-1" },
          { id: "s-3", title: "Public API", status: "New", goalId: "g-1" },
        ],
      },
    ],
    totalSolutions: 3,
    appBaseUrl: APP_BASE_URL,
  } satisfies RoadmapProps,
};
