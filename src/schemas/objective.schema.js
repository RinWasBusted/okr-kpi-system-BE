import { z } from "zod";

const LIMITS = {
    title: { min: 1, max: 255 },
    description: { max: 1000 },
};

const nullableIdSchema = z.preprocess((value) => {
    if (value === undefined) return undefined;
    if (value === null || value === "" || value === 0 || value === "0") return null;
    return value;
}, z.coerce.number().int().positive().nullable().optional());

export const createObjectiveSchema = z.object({
    title: z
        .string()
        .min(LIMITS.title.min, "title is required")
        .max(LIMITS.title.max, `title must not exceed ${LIMITS.title.max} characters`),
    cycle_id: z.coerce.number().int().positive("cycle_id is required"),
    unit_id: nullableIdSchema,
    owner_id: nullableIdSchema,
    parent_objective_id: nullableIdSchema,
    visibility: z.enum(["PUBLIC", "INTERNAL", "PRIVATE"]).optional(),
    description: z.string().max(LIMITS.description.max).nullable().optional(),
});

export const updateObjectiveSchema = z.object({
    title: z
        .string()
        .min(LIMITS.title.min, "title cannot be empty")
        .max(LIMITS.title.max, `title must not exceed ${LIMITS.title.max} characters`)
        .optional(),
    parent_objective_id: nullableIdSchema,
    visibility: z.enum(["PUBLIC", "INTERNAL", "PRIVATE"]).optional(),
    description: z.string().max(LIMITS.description.max).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
});

export const listObjectivesQuerySchema = z.object({
    cycle_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    unit_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    owner_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    status: z.enum(["Draft", "Pending_Approval", "Rejected", "NOT_STARTED", "ON_TRACK", "AT_RISK", "CRITICAL", "COMPLETED"]).optional(),
    visibility: z.enum(["PUBLIC", "INTERNAL", "PRIVATE"]).optional(),
    parent_objective_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
    per_page: z.string().regex(/^\d+$/).transform(Number).optional().default("20"),
    include_key_results: z.enum(["true", "false"]).transform((v) => v === "true").optional().default("false"),
    mode: z.enum(["tree", "list"]).optional().default("tree"),
}).passthrough();

export const getAvailableParentObjectivesSchema = z.object({
    unit_id: z.string().regex(/^\d+$/).transform(Number),
    cycle_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    include_key_results: z.enum(["true", "false"]).transform((v) => v === "true").optional().default("false"),
});
