import { z } from "zod";

const LIMITS = {
    content: { min: 1, max: 5000 },
};

export const createFeedbackSchema = z.object({
    content: z
        .string()
        .min(LIMITS.content.min, "content is required")
        .max(LIMITS.content.max, `content must not exceed ${LIMITS.content.max} characters`),
    type: z.enum(["PRAISE", "CONCERN", "SUGGESTION", "QUESTION", "BLOCKER"]),
    kr_tag_id: z.number().int().positive().nullable().optional(),
});

export const updateFeedbackSchema = z.object({
    content: z
        .string()
        .min(LIMITS.content.min, "content cannot be empty")
        .max(LIMITS.content.max, `content must not exceed ${LIMITS.content.max} characters`)
        .optional(),
    type: z.enum(["PRAISE", "CONCERN", "SUGGESTION", "QUESTION", "BLOCKER"]).optional(),
    status: z.enum(["ACTIVE", "RESOLVED", "FLAGGED"]).optional(),
    kr_tag_id: z.number().int().positive().nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
});

export const createReplySchema = z.object({
    content: z
        .string()
        .min(LIMITS.content.min, "content is required")
        .max(LIMITS.content.max, `content must not exceed ${LIMITS.content.max} characters`),
    type: z.enum(["PRAISE", "CONCERN", "SUGGESTION", "QUESTION", "BLOCKER"]),
});

export const listFeedbacksQuerySchema = z.object({
    type: z.enum(["PRAISE", "CONCERN", "SUGGESTION", "QUESTION", "BLOCKER"]).optional(),
    sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE", "MIXED", "UNKNOWN"]).optional(),
    status: z.enum(["ACTIVE", "RESOLVED", "FLAGGED"]).optional(),
    kr_tag_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default("1"),
    per_page: z.string().regex(/^\d+$/).transform(Number).default("20"),
});
