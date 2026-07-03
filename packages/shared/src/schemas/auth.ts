import { z } from 'zod';
import { GROUP_CATEGORIES } from '../constants/categories';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(GROUP_CATEGORIES).default('Other'),
  memberEmails: z.array(z.string().email()).optional(),
  currency: z.string().length(3).optional(),
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.enum(GROUP_CATEGORIES).optional(),
  currency: z.string().length(3).optional(),
});

export const joinGroupSchema = z.object({
  inviteCode: z.string().min(6).max(12),
});

const MAX_AMOUNT = 1_000_000_000;

export const createExpenseSchema = z.object({
  groupId: z.string().uuid(),
  description: z.string().min(1).max(500),
  amount: z.number().positive().max(MAX_AMOUNT),
  category: z.string().min(1).max(50),
  paidById: z.string().uuid(),
  date: z.string().datetime().optional(),
  splitType: z.enum(['equal', 'exact', 'percentage', 'shares']),
  splits: z.array(
    z.object({
      userId: z.string().uuid(),
      amount: z.number().nonnegative().max(MAX_AMOUNT),
    }),
  ),
  receiptUrl: z.string().url().max(2000).optional(),
});

export const updateExpenseSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  amount: z.number().positive().max(MAX_AMOUNT).optional(),
  category: z.string().min(1).max(50).optional(),
  paidById: z.string().uuid().optional(),
  splitType: z.enum(['equal', 'exact', 'percentage', 'shares']).optional(),
  splits: z
    .array(
      z.object({
        userId: z.string().uuid(),
        amount: z.number().nonnegative().max(MAX_AMOUNT),
      }),
    )
    .optional(),
  receiptUrl: z.string().url().max(2000).optional(),
});

export const parseExpenseRequestSchema = z
  .object({
    text: z.string().min(1).max(500),
    groupId: z.string().uuid().optional(),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type JoinGroupInput = z.infer<typeof joinGroupSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type ParseExpenseRequest = z.infer<typeof parseExpenseRequestSchema>;
