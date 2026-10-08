import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const organisationSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z.string().min(2).max(128).regex(/^[a-z0-9-]+$/),
  industry: z.string().optional(),
  jurisdiction: z.string().optional(),
});

export const assessmentSchema = z.object({
  title: z.string().min(2),
  questionnaireId: z.string().uuid(),
});

export const metricValueSchema = z.object({
  metricId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-(Q[1-4]|\d{2})$/),
  value: z.coerce.number().finite(),
  siteId: z.string().uuid().optional().nullable(),
});

export const dataRequestSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  period: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  ownerId: z.string().uuid().optional().nullable(),
});

export const ghgRunSchema = z.object({
  scope: z.enum(["Scope 1", "Scope 2", "Scope 3"]),
  period: z.string().regex(/^\d{4}-(Q[1-4]|\d{2})$/),
  inputs: z.array(z.object({
    label: z.string().min(1),
    activityData: z.coerce.number().positive(),
    unit: z.string().min(1),
    factorId: z.string().uuid(),
    siteId: z.string().uuid().optional().nullable(),
  })).min(1),
});

export const materialityTopicSchema = z.object({
  topic: z.string().min(2),
  category: z.string().optional(),
  impactScore: z.coerce.number().int().min(1).max(4),
  financialScore: z.coerce.number().int().min(1).max(4),
  rationale: z.string().optional(),
});

export const riskSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  category: z.string().optional(),
  likelihood: z.coerce.number().int().min(1).max(5).optional(),
  impact: z.coerce.number().int().min(1).max(5).optional(),
});

export const targetSchema = z.object({
  title: z.string().min(2),
  metricId: z.string().uuid().optional().nullable(),
  kind: z.string().optional(),
  baselineYear: z.coerce.number().int().optional(),
  baselineValue: z.coerce.number().optional(),
  targetYear: z.coerce.number().int().optional(),
  targetValue: z.coerce.number().optional(),
});

export const reportSchema = z.object({
  title: z.string().min(2),
  period: z.string().optional(),
});
