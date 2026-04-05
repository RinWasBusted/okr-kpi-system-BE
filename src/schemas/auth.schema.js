import {z} from 'zod';

export const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters long' }),
  company_slug: z.string().optional(),
  remember_me: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6, { message: 'Current password must be at least 6 characters long' }),
  newPassword: z.string().min(8, { message: 'New password must be at least 8 characters long, contain at least one uppercase letter and one number' })
    .regex(/^(?=.*[A-Z])(?=.*\d)/, { message: 'New password must contain at least one uppercase letter and one number' }),
  confirmPassword: z.string().optional(),
}).refine((data) => !data.confirmPassword || data.newPassword === data.confirmPassword, {
  message: "Confirm password must match new password",
  path: ["confirmPassword"],
});