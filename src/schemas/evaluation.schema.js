import { PerformanceRating } from "@prisma/client";
import { z } from "zod";

const positiveIntString = z.string().regex(/^\d+$/).transform(Number);

export const generateEvaluationsBodySchema = z.object({
    cycle_id: z.coerce.number().int().positive(),
});

export const listEvaluationsQuerySchema = z.object({
    cycle_id: positiveIntString,
    unit_id: positiveIntString.optional(),
    rating: z.nativeEnum(PerformanceRating).optional(),
    page: positiveIntString.optional().default("1"),
    per_page: positiveIntString
        .refine((value) => value <= 100, "per_page must not exceed 100")
        .optional()
        .default("20"),
}).passthrough();

export const listEvaluationHistoryQuerySchema = z.object({
    page: positiveIntString.optional().default("1"),
    per_page: positiveIntString
        .refine((value) => value <= 100, "per_page must not exceed 100")
        .optional()
        .default("10"),
}).passthrough();

export const companyEmployeesEvaluationsQuerySchema = z.object({
    cycle_id: positiveIntString,
}).passthrough();
