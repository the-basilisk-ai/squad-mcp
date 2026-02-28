import { z } from "zod";

const goalSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  priority: z.number(),
});

const roadmapSolutionSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  goalId: z.string().optional(),
});

const horizonColumnSchema = z.object({
  horizon: z.enum(["now", "next", "later"]),
  solutions: z.array(roadmapSolutionSchema),
});

export const propSchema = z.object({
  goals: z.array(goalSummarySchema),
  columns: z.array(horizonColumnSchema),
  totalSolutions: z.number(),
  appBaseUrl: z.string().optional(),
});

export type RoadmapProps = z.infer<typeof propSchema>;
export type GoalSummary = z.infer<typeof goalSummarySchema>;
export type RoadmapSolution = z.infer<typeof roadmapSolutionSchema>;
export type HorizonColumn = z.infer<typeof horizonColumnSchema>;
