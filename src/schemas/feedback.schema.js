import { z } from "zod";

const LIMITS = {
  content: { min: 1, max: 5000 },
};

const nullableIdSchema = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "" || value === 0 || value === "0")
    return null;
  return value;
}, z.coerce.number().int().positive().nullable().optional());

export const createFeedbackSchema = z.object({
  content: z
    .string()
    .min(LIMITS.content.min, "content is required")
    .max(
      LIMITS.content.max,
      `content must not exceed ${LIMITS.content.max} characters`,
    ),
  status: z.enum(["PRAISE", "CONCERN", "SUGGESTION", "QUESTION", "BLOCKER"]),
  kr_tag_id: nullableIdSchema,
});

export const updateFeedbackSchema = z
  .object({
    content: z
      .string()
      .min(LIMITS.content.min, "content cannot be empty")
      .max(
        LIMITS.content.max,
        `content must not exceed ${LIMITS.content.max} characters`,
      )
      .optional(),
    status: z
      .enum(["PRAISE", "CONCERN", "SUGGESTION", "QUESTION", "BLOCKER"])
      .optional(),
    kr_tag_id: nullableIdSchema,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
  });

export const createReplySchema = z.object({
  content: z
    .string()
    .min(LIMITS.content.min, "content is required")
    .max(
      LIMITS.content.max,
      `content must not exceed ${LIMITS.content.max} characters`,
    ),
  status: z.enum(["RESOLVED", "FLAGGED"]),
  kr_tag_id: nullableIdSchema,
});

export const listFeedbacksQuerySchema = z
  .object({
    sentiment: z
      .enum(["POSITIVE", "NEUTRAL", "NEGATIVE", "MIXED", "UNKNOWN"])
      .optional(),
    status: z
      .enum([
        "PRAISE",
        "CONCERN",
        "SUGGESTION",
        "QUESTION",
        "BLOCKER",
        "RESOLVED",
        "FLAGGED",
      ])
      .optional(),
    kr_tag_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
    per_page: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .optional()
      .default("20"),
  })
  .passthrough();
