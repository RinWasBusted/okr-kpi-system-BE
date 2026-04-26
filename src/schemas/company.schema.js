import { z } from "zod";

const LIMITS = {
    name: { min: 1, max: 255 },
    slug: { min: 3, max: 60 },
    logo: { max: 2048 },
};

export const createCompanySchema = z.object({
    name: z
        .string()
        .min(LIMITS.name.min, "name is required")
        .max(LIMITS.name.max, `name must not exceed ${LIMITS.name.max} characters`),
    slug: z
        .string()
        .min(LIMITS.slug.min, `slug must be at least ${LIMITS.slug.min} characters`)
        .max(LIMITS.slug.max, `slug must not exceed ${LIMITS.slug.max} characters`)
        .regex(/^[a-z0-9-]+$/, "slug must contain only lowercase letters, numbers, and hyphens"),
    ai_plan: z.enum(["FREE", "SUBSCRIPTION", "PAY_AS_YOU_GO"]).optional(),
});

export const updateCompanySchema = z.object({
    name: z
        .string()
        .min(LIMITS.name.min, "name cannot be empty")
        .max(LIMITS.name.max, `name must not exceed ${LIMITS.name.max} characters`)
        .optional(),
    slug: z
        .string()
        .min(LIMITS.slug.min, `slug must be at least ${LIMITS.slug.min} characters`)
        .max(LIMITS.slug.max, `slug must not exceed ${LIMITS.slug.max} characters`)
        .regex(/^[a-z0-9-]+$/, "slug must contain only lowercase letters, numbers, and hyphens")
        .optional(),
    is_active: z.boolean().optional(),
    ai_plan: z.enum(["FREE", "SUBSCRIPTION", "PAY_AS_YOU_GO"]).optional(),
    usage_limit: z.coerce.number().int().min(0).optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
});

export const createCompanyAdminSchema = z.object({
    full_name: z.string().min(1).max(255),
    email: z.string().min(1).max(255).email(),
    password: z.string().min(8).max(255),
});
