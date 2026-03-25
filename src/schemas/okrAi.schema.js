import { z } from "zod";

export const generateKeyResultsSchema = z.object({
  count: z.number().int().min(1).max(10).optional().default(5),
  language: z.enum(["vi", "en"]).optional().default("vi"),
  // Optional hints to steer generation
  constraints: z
    .object({
      due_date: z.string().date().optional(), // YYYY-MM-DD
      unit: z.string().min(1).max(32).optional(),
    })
    .optional(),
});

export const generateTestKeyResultsSchema = z.object({
  // "Obj" (Objective title/description) user provides for testing.
  objective: z.string().min(8).max(300),
  count: z.number().int().min(1).max(10).optional().default(5),
  language: z.enum(["vi", "en"]).optional().default("vi"),
  constraints: z
    .object({
      due_date: z.string().date().optional(), // YYYY-MM-DD
      unit: z.string().min(1).max(32).optional(),
    })
    .optional(),
});

