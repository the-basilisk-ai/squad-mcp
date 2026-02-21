import { z } from "zod";

const hierarchyNodeSchema = z.object({
  id: z.string(),
  type: z.enum([
    "workspace",
    "goal",
    "opportunity",
    "solution",
    "insight",
    "feedback",
  ]),
  title: z.string(),
  description: z.string().optional(),
  status: z.string().optional(),
  horizon: z.string().optional(),
  isRecommended: z.boolean().optional(),
  insightCount: z.number().optional(),
  hasUnseenInsights: z.boolean().optional(),
  missionStatement: z.string().optional(),
  priority: z.number().optional(),
  insightType: z.string().optional(),
  source: z.string().optional(),
  childCount: z.number().optional(),
  childType: z
    .enum(["goal", "opportunity", "solution", "insight", "feedback"])
    .optional(),
});

const childGroupSchema = z.object({
  type: z.enum(["goal", "opportunity", "solution", "insight", "feedback"]),
  count: z.number(),
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: z.string().optional(),
    }),
  ),
});

export const propSchema = z.object({
  ancestors: z.array(hierarchyNodeSchema),
  focused: hierarchyNodeSchema,
  children: childGroupSchema.optional().nullable(),
  appBaseUrl: z.string().optional(),
});

export type EntityContextProps = z.infer<typeof propSchema>;
export type HierarchyNode = z.infer<typeof hierarchyNodeSchema>;
export type ChildGroup = z.infer<typeof childGroupSchema>;
export type EntityType = HierarchyNode["type"];
