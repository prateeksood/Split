import { z } from 'zod';

export const settlementSchema = z.object({
  payeeId: z.string().uuid(),
  payerId: z.string().uuid().optional(),
  amount: z.number().positive().max(1_000_000_000),
  currency: z.string().length(3).default('USD'),
  groupId: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
  paymentRef: z.string().max(200).optional(),
});

export const addMemberSchema = z.object({
  email: z.string().email(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

export const addFriendSchema = z.object({
  email: z.string().email(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(256),
  password: z.string().min(8).max(128),
});

export const googleAuthSchema = z.object({
  idToken: z.string().min(1).max(4096),
});

export const googleCodeAuthSchema = z.object({
  code: z.string().min(1).max(2048),
  redirectUri: z.string().min(1).max(2048),
  codeVerifier: z.string().min(1).max(256),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  defaultCurrency: z.string().length(3).optional(),
  pushToken: z.string().max(512).optional(),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1).max(256),
});

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

export type SettlementInput = z.infer<typeof settlementSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type AddFriendInput = z.infer<typeof addFriendSchema>;
