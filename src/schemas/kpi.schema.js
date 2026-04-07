import { z } from "zod";

const LIMITS = {
    name: { min: 1, max: 255 },
    unit: { min: 1, max: 50 },
    evaluation_method: { min: 1, max: 50 },
    title: { min: 1, max: 255 },
};

// KPI Dictionary schemas
export const createKPIDictionarySchema = z.object({
    name: z
        .string()
        .min(LIMITS.name.min, "name is required")
        .max(LIMITS.name.max, `name must not exceed ${LIMITS.name.max} characters`),
    unit: z
        .string()
        .min(LIMITS.unit.min, "unit is required")
        .max(LIMITS.unit.max, `unit must not exceed ${LIMITS.unit.max} characters`),
    evaluation_method: z.enum(["MAXIMIZE", "MINIMIZE", "TARGET"]),
    description: z.string().max(1000).optional(),
});

export const updateKPIDictionarySchema = z.object({
    name: z
        .string()
        .min(LIMITS.name.min, "name cannot be empty")
        .max(LIMITS.name.max, `name must not exceed ${LIMITS.name.max} characters`)
        .optional(),
    unit: z
        .string()
        .min(LIMITS.unit.min, "unit cannot be empty")
        .max(LIMITS.unit.max, `unit must not exceed ${LIMITS.unit.max} characters`)
        .optional(),
    evaluation_method: z.enum(["MAXIMIZE", "MINIMIZE", "TARGET"]).optional(),
    description: z.string().max(1000).optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
});

// KPI Assignment schemas
export const createKPIAssignmentSchema = z.object({
    kpi_dictionary_id: z.coerce.number().int().positive("kpi_dictionary_id is required"),
    cycle_id: z.coerce.number().int().positive("cycle_id is required"),
    target_value: z.coerce.number().positive("target_value must be positive"),
    current_value: z.coerce.number().min(0).default(0),
    unit_id: z.coerce.number().int().positive().nullable().optional(),
    owner_id: z.coerce.number().int().positive().nullable().optional(),
    parent_assignment_id: z.coerce.number().int().positive().nullable().optional(),
    visibility: z.enum(["PUBLIC", "INTERNAL", "PRIVATE"]).optional(),
    due_date: z.string().datetime().optional(),
}).refine(
    (data) => (data.unit_id && !data.owner_id) || (!data.unit_id && data.owner_id),
    {
        message: "Either unit_id or owner_id must be provided, but not both",
    }
);

export const updateKPIAssignmentSchema = z.object({
    cycle_id: z.coerce.number().int().positive().optional(),
    target_value: z.coerce.number().positive().optional(),
    current_value: z.coerce.number().min(0).optional(),
    visibility: z.enum(["PUBLIC", "INTERNAL", "PRIVATE"]).optional(),
    due_date: z.string().datetime().optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
});

// Key Result schemas
export const createKeyResultSchema = z.object({
    title: z
        .string()
        .min(LIMITS.title.min, "title is required")
        .max(LIMITS.title.max, `title must not exceed ${LIMITS.title.max} characters`),
    target_value: z.coerce.number().positive("target_value must be positive"),
    current_value: z.coerce.number().min(0).default(0),
    unit: z
        .string()
        .min(LIMITS.unit.min, "unit is required")
        .max(LIMITS.unit.max, `unit must not exceed ${LIMITS.unit.max} characters`),
    weight: z.coerce.number().min(0).max(100).default(100),
    due_date: z.string().datetime().optional(),
});

export const updateKeyResultSchema = z.object({
    title: z
        .string()
        .min(LIMITS.title.min, "title cannot be empty")
        .max(LIMITS.title.max, `title must not exceed ${LIMITS.title.max} characters`)
        .optional(),
    target_value: z.coerce.number().positive().optional(),
    unit: z
        .string()
        .min(LIMITS.unit.min)
        .max(LIMITS.unit.max)
        .optional(),
    weight: z.coerce.number().min(0).max(100).optional(),
    due_date: z.string().datetime().optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
});

// KPI Assignment params schema
export const kpiAssignmentIdSchema = z.object({
    id: z.coerce.number().int().positive("Invalid assignment ID"),
});

// KPI Record schemas
export const createKPIRecordSchema = z.object({
    period_start: z.string().datetime(),
    period_end: z.string().datetime(),
    actual_value: z.coerce.number().min(0),
});

// CheckIn schemas
export const createCheckInSchema = z.object({
    achieved_value: z.coerce.number(),
    evidence_url: z.string().url("evidence_url must be a valid URL").max(2048, "evidence_url must not exceed 2048 characters"),
    comment: z.string().max(1000).optional(),
});

// KPI Assignment list query schema
export const listKPIAssignmentsQuerySchema = z.object({
    cycle_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    unit_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    owner_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    visibility: z.enum(["PUBLIC", "INTERNAL", "PRIVATE"]).optional(),
    parent_assignment_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    // Progress status filter based on progress_percentage
    progress_status: z.enum(["NOT_STARTED", "ON_TRACK", "AT_RISK", "CRITICAL", "COMPLETED"]).optional(),
    // KPIStatus filter from latest record
    kpi_status: z.enum(["ON_TRACK", "AT_RISK", "CRITICAL"]).optional(),
    // Activity status filter
    status: z.enum(["active", "deleted"]).optional().default("active"),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
    per_page: z.string().regex(/^\d+$/).transform(Number).optional().default("20"),
    mode: z.enum(["tree", "list"]).optional().default("tree"),
}).passthrough();
