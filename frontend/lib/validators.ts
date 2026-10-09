import { z } from 'zod';

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const registerSchema = z.object({
  company_name: z.string().min(2, 'Company name must be at least 2 characters').max(150),
  subdomain: z.string().regex(/^[a-z0-9-]{3,63}$/, 'Subdomain must be 3-63 lowercase letters, numbers, or hyphens').refine(val => !['www', 'api', 'admin', 'app'].includes(val), {
    message: 'Reserved subdomain',
  }),
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address').max(150),
  password: z.string().regex(passwordPattern, 'Password must be at least 8 characters, contain 1 uppercase, 1 number, and 1 special character.'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Phone number must be in E.164 format').optional().or(z.literal('')),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  subdomain: z.string().min(1, 'Subdomain is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  subdomain: z.string().min(1, 'Subdomain is required'),
});

export const resetPasswordSchema = z.object({
  new_password: z.string().regex(passwordPattern, 'Password must be at least 8 characters, contain 1 uppercase, 1 number, and 1 special character.'),
});

export const twoFactorSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type TwoFactorInput = z.infer<typeof twoFactorSchema>;
