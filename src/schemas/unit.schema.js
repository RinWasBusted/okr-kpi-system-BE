import { z } from "zod";

const LIMITS = {
    name: { min: 1, max: 255 },
};

const nullableIdSchema = z.preprocess((value) => {
    if (value === undefined) return undefined;
    if (value === null || value === "" || value === 0 || value === "0") return null;
    return value;
}, z.coerce.number().int().positive().nullable().optional());

export const createUnitSchema = z.object({
    name: z
        .string()
        .min(LIMITS.name.min, "name is required")
        .max(LIMITS.name.max, `name must not exceed ${LIMITS.name.max} characters`),
    parent_id: nullableIdSchema,
    manager_id: nullableIdSchema,
});

export const updateUnitSchema = z.object({
    name: z
        .string()
        .min(LIMITS.name.min, "name cannot be empty")
        .max(LIMITS.name.max, `name must not exceed ${LIMITS.name.max} characters`)
        .optional(),
    parent_id: nullableIdSchema,
    manager_id: nullableIdSchema,
}).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
});

export const listUnitsQuerySchema = z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
    per_page: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .refine((n) => n <= 100, "per_page must not exceed 100")
        .optional()
        .default("100"),
    mode: z.enum(["tree", "list"]).optional().default("tree"),
}).passthrough();
