import { z } from "zod";

const LIMITS = {
    title: { min: 1, max: 255 },
    description: { max: 1000 },
};

export const createObjectiveSchema = z.object({
    title: z
        .string()
        .min(LIMITS.title.min, "title is required")
        .max(LIMITS.title.max, `title must not exceed ${LIMITS.title.max} characters`),
    cycle_id: z.number().int().positive("cycle_id is required"),
    unit_id: z.number().int().positive().nullable().optional(),
    owner_id: z.number().int().positive().nullable().optional(),
    parent_objective_id: z.number().int().positive().nullable().optional(),
    visibility: z.enum(["PUBLIC", "INTERNAL", "PRIVATE"]).optional(),
});

export const updateObjectiveSchema = z.object({
    title: z
        .string()
        .min(LIMITS.title.min, "title cannot be empty")
        .max(LIMITS.title.max, `title must not exceed ${LIMITS.title.max} characters`)
        .optional(),
    parent_objective_id: z.number().int().positive().nullable().optional(),
    visibility: z.enum(["PUBLIC", "INTERNAL", "PRIVATE"]).optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
});

export const listObjectivesQuerySchema = z.object({
    cycle_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    unit_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    owner_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    status: z.enum(["Draft", "Active", "Pending_Approval", "Rejected", "Completed"]).optional(),
    visibility: z.enum(["PUBLIC", "INTERNAL", "PRIVATE"]).optional(),
    parent_objective_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    // Progress status filter based on progress_percentage
    progress_status: z.enum(["NOT_STARTED", "DANGER", "WARNING", "ON_TRACK", "COMPLETED"]).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
    per_page: z.string().regex(/^\d+$/).transform(Number).optional().default("20"),
    include_key_results: z.enum(["true", "false"]).transform((v) => v === "true").optional().default("false"),
    mode: z.enum(["tree", "list"]).optional().default("tree"),
}).passthrough();
