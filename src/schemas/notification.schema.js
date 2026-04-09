import { z } from "zod";

/**
 * Schema for listing notifications
 */
export const listNotificationsQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .positive("Page must be a positive integer")
    .optional()
    .default(1),
  page_size: z.coerce
    .number()
    .int()
    .positive("Page size must be a positive integer")
    .max(100, "Page size cannot exceed 100")
    .optional()
    .default(10),
  is_read: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return val === "true" || val === "1";
    }),
});

/**
 * Schema for marking a notification as read
 */
export const markNotificationReadParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive("Notification ID must be a positive integer"),
});

/**
 * Schema for creating a notification (internal service use)
 */
export const createNotificationSchema = z.object({
  companyId: z
    .number()
    .int()
    .positive("Company ID must be a positive integer"),
  eventType: z
    .string()
    .min(1, "Event type is required")
    .trim(),
  refType: z
    .string()
    .min(1, "Reference type is required")
    .trim(),
  refId: z
    .number()
    .int()
    .positive("Reference ID must be a positive integer"),
  actorId: z.number().int().positive("Actor ID must be a positive integer").optional(),
  actorName: z.string().optional(),
  entityName: z.string().optional(),
  recipientIds: z
    .array(z.number().int().positive("Each recipient ID must be a positive integer"))
    .min(1, "At least one recipient ID is required"),
});
