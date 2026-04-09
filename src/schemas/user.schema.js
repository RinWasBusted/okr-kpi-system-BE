import { z } from "zod";

// Common string limits matching database constraints
const LIMITS = {
    full_name: { min: 1, max: 255 },
    email: { min: 1, max: 255 },
    password: { min: 8, max: 255 },
    job_title: { min: 0, max: 100 },
    avatar_url: { min: 0, max: 2048 },
};

const nullableIdSchema = z.preprocess((value) => {
    if (value === undefined) return undefined;
    if (value === null || value === "" || value === 0 || value === "0") return null;
    return value;
}, z.coerce.number().int().positive().nullable().optional());

export const createUserSchema = z.object({
    full_name: z
        .string()
        .min(LIMITS.full_name.min, "full_name is required")
        .max(LIMITS.full_name.max, `full_name must not exceed ${LIMITS.full_name.max} characters`),
    email: z
        .string()
        .min(LIMITS.email.min, "email is required")
        .max(LIMITS.email.max, `email must not exceed ${LIMITS.email.max} characters`)
        .email("Invalid email format"),
    password: z
        .string()
        .min(LIMITS.password.min, `Password must be at least ${LIMITS.password.min} characters`)
        .max(LIMITS.password.max, `Password must not exceed ${LIMITS.password.max} characters`),
    unit_id: nullableIdSchema,
});

export const updateUserSchema = z.object({
    full_name: z
        .string()
        .min(LIMITS.full_name.min, "full_name cannot be empty")
        .max(LIMITS.full_name.max, `full_name must not exceed ${LIMITS.full_name.max} characters`)
        .optional(),
    unit_id: nullableIdSchema,
    password: z
        .string()
        .min(LIMITS.password.min, `Password must be at least ${LIMITS.password.min} characters`)
        .max(LIMITS.password.max, `Password must not exceed ${LIMITS.password.max} characters`)
        .optional(),
    is_active: z.boolean().nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
});

// For validating query parameters
export const listUsersQuerySchema = z.object({
    unit_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    search: z.string().max(255).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
    per_page: z.string().regex(/^\d+$/).transform(Number).optional().default("20"),
}).passthrough();
