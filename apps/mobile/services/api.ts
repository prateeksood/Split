import { Platform } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import type { ParsedExpense } from '@split/shared';
import { parseApiErrorMessage } from './apiErrors';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// On web, include credentials so the httpOnly refresh-token cookie is sent/received.
const IS_WEB = Platform.OS === 'web';
const WEB_CREDENTIALS: RequestCredentials | undefined = IS_WEB ? 'include' : undefined;

class ApiClient {
  private baseUrl: string;
  // Shared refresh promise prevents parallel token refresh races.
  private refreshPromise: Promise<void> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Public convenience methods for external use (e.g. adminApi) without accessing private internals.
  get<T>(path: string) { return this.request<T>(path); }
  post<T>(path: string, body?: unknown) { return this.request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }); }
  del<T>(path: string) { return this.request<T>(path, { method: 'DELETE' }); }

  private async doRefresh(): Promise<boolean> {
    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken && !IS_WEB) return;
        const refreshed = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: WEB_CREDENTIALS,
          body: JSON.stringify(refreshToken ? { refreshToken } : {}),
        });
        if (refreshed.ok) {
          const tokens = await refreshed.json();
          await useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
        } else {
          await useAuthStore.getState().clearTokens();
          throw new Error('refresh_failed');
        }
      })().finally(() => {
        this.refreshPromise = null;
      });
    }
    try {
      await this.refreshPromise;
      return true;
    } catch {
      return false;
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = useAuthStore.getState().accessToken;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
      credentials: WEB_CREDENTIALS,
    });

    if (response.status === 401) {
      const canRetry = await this.doRefresh();
      if (canRetry) {
        const newToken = useAuthStore.getState().accessToken;
        if (newToken) headers.Authorization = `Bearer ${newToken}`;
        const retry = await fetch(`${this.baseUrl}${path}`, { ...options, headers, credentials: WEB_CREDENTIALS });
        if (!retry.ok) throw ApiError.fromResponse(retry.status, await retry.text());
        return retry.json();
      }
    }

    if (!response.ok) throw ApiError.fromResponse(response.status, await response.text());
    return response.json();
  }

  auth = {
    login: (email: string, password: string) =>
      this.request<{ accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (data: { email: string; password: string; name: string }) =>
      this.request<{ requiresEmailVerification: boolean; email: string; message: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    verifyEmail: (token: string) =>
      this.request<{ accessToken: string; refreshToken: string }>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    resendVerification: (email: string) =>
      this.request<{ message: string }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    logout: (refreshToken?: string) =>
      this.request<{ success: boolean }>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      }),
    forgotPassword: (email: string) =>
      this.request<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    resetPassword: (token: string, password: string) =>
      this.request<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),
    google: (idToken: string) =>
      this.request<{ accessToken: string; refreshToken: string }>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      }),
    googleCode: (data: { code: string; redirectUri: string; codeVerifier: string }) =>
      this.request<{ accessToken: string; refreshToken: string }>('/auth/google/code', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  users = {
    me: () => this.request<UserProfile>('/users/me'),
    dashboard: () => this.request<DashboardData>('/users/dashboard'),
    update: (data: Partial<{ name: string; defaultCurrency: string; pushToken: string }>) =>
      this.request<UserProfile>('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  };

  groups = {
    list: () => this.request<GroupSummary[]>('/groups'),
    get: (id: string) => this.request<GroupDetail>(`/groups/${id}`),
    create: (data: { name: string; category?: string; memberEmails?: string[]; currency?: string }) =>
      this.request<GroupSummary>('/groups', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; category?: string; currency?: string }) =>
      this.request<GroupDetail>(`/groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    addMember: (id: string, email: string) =>
      this.request(`/groups/${id}/members`, { method: 'POST', body: JSON.stringify({ email }) }),
    updateMemberRole: (id: string, memberUserId: string, role: 'admin' | 'member') =>
      this.request(`/groups/${id}/members/${memberUserId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    archive: (id: string) => this.request(`/groups/${id}`, { method: 'DELETE' }),
    removeMember: (groupId: string, userId: string) =>
      this.request(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
    previewJoin: (code: string) => this.request<GroupJoinPreview>(`/groups/join/${encodeURIComponent(code)}`),
    join: (inviteCode: string) =>
      this.request<GroupJoinResult>('/groups/join', { method: 'POST', body: JSON.stringify({ inviteCode }) }),
    getInvite: (id: string) => this.request<GroupInviteInfo>(`/groups/${id}/invite`),
    regenerateInvite: (id: string) => this.request<GroupInviteInfo>(`/groups/${id}/invite/regenerate`, { method: 'POST' }),
  };

  expenses = {
    recent: () => this.request<ExpenseItem[]>('/expenses/recent'),
    create: (data: CreateExpensePayload) =>
      this.request('/expenses', { method: 'POST', body: JSON.stringify(data) }),
    update: (
      id: string,
      data: {
        description?: string;
        amount?: number;
        category?: string;
        paidById?: string;
        splitType?: string;
        splits?: { userId: string; amount: number }[];
        receiptUrl?: string;
      },
    ) => this.request(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => this.request(`/expenses/${id}`, { method: 'DELETE' }),
  };

  settlements = {
    list: () => this.request<{ items: SettlementItem[]; hasMore: boolean }>('/settlements'),
    create: (data: SettlementPayload) =>
      this.request('/settlements', { method: 'POST', body: JSON.stringify(data) }),
    void: (id: string) => this.request(`/settlements/${id}`, { method: 'DELETE' }),
  };

  friends = {
    list: () => this.request<FriendItem[]>('/friends'),
    add: (email: string) =>
      this.request('/friends', { method: 'POST', body: JSON.stringify({ email }) }),
    inviteLink: () => this.request<{ link: string; message: string; smsUrl: string }>('/friends/invite'),
    acceptInvite: (ref: string) =>
      this.request<{ friendId: string; name: string; alreadyFriends: boolean }>('/friends/accept-invite', {
        method: 'POST',
        body: JSON.stringify({ ref }),
      }),
  };

  notifications = {
    list: (page = 0, limit = 20) =>
      this.request<NotificationPage>(`/notifications?page=${page}&limit=${limit}`),
    unreadCount: () => this.request<number>('/notifications/unread-count'),
    markRead: (id: string) => this.request(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => this.request('/notifications/read-all', { method: 'PATCH' }),
  };

  activity = {
    feed: (params: { q?: string; groupId?: string; type?: 'all' | 'expense' | 'settlement' | 'member'; page?: number; limit?: number } = {}) => {
      const qs = new URLSearchParams();
      if (params.q) qs.set('q', params.q);
      if (params.groupId) qs.set('groupId', params.groupId);
      if (params.type && params.type !== 'all') qs.set('type', params.type);
      if (params.page != null) qs.set('page', String(params.page));
      if (params.limit != null) qs.set('limit', String(params.limit));
      const query = qs.toString();
      return this.request<ActivityFeed>(`/activity${query ? `?${query}` : ''}`);
    },
  };

  reports = {
    categories: (groupId?: string, range = 'all') =>
      this.request<CategoryReportItem[]>(`/reports/categories?range=${range}${groupId ? `&groupId=${groupId}` : ''}`),
    monthly: (groupId?: string, range = '1y') =>
      this.request<MonthlyReportItem[]>(`/reports/monthly?range=${range}${groupId ? `&groupId=${groupId}` : ''}`),
    weekly: (groupId?: string, range = '30d') =>
      this.request<{ week: string; amount: number }[]>(`/reports/weekly?range=${range}${groupId ? `&groupId=${groupId}` : ''}`),
    groups: (range = 'all') =>
      this.request<{ groupId: string; name: string; amount: number; count: number }[]>(`/reports/groups?range=${range}`),
    insights: (range = '30d') =>
      this.request<{ insights: InsightItem[]; totalSpend: number; expenseCount: number }>(`/reports/insights?range=${range}`),
    exportCsv: (groupId?: string) =>
      this.request<{ csv: string }>(`/reports/export${groupId ? `?groupId=${groupId}` : ''}`),
    exportPdf: (groupId?: string) =>
      this.request<{ pdf: string; filename: string }>(`/reports/export/pdf${groupId ? `?groupId=${groupId}` : ''}`),
  };

  currency = {
    rates: (base = 'USD') => this.request<Record<string, number>>(`/currency/rates?base=${base}`),
    convert: (amount: number, from: string, to: string) =>
      this.request<{ result: number }>(`/currency/convert?amount=${amount}&from=${from}&to=${to}`),
  };

  ai = {
    parseExpense: (text: string, groupId?: string) =>
      this.request<ParsedExpense>('/ai/parse-expense', {
        method: 'POST',
        body: JSON.stringify({ text, ...(groupId ? { groupId } : {}) }),
      }),
  };

  uploads = {
    presignReceipt: (contentType: string) =>
      this.request<{ uploadUrl: string; receiptUrl: string }>('/uploads/receipt/presign', {
        method: 'POST',
        body: JSON.stringify({ contentType }),
      }),
    uploadReceipt: async (uri: string, contentType: string) => {
      const { uploadUrl, receiptUrl } = await this.uploads.presignReceipt(contentType);
      const blob = await fetch(uri).then((r) => r.blob());
      const upload = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob,
      });
      if (!upload.ok) throw ApiError.fromResponse(upload.status, 'Receipt upload failed');
      return receiptUrl;
    },
  };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static fromResponse(status: number, body: string): ApiError {
    return new ApiError(status, parseApiErrorMessage(body));
  }
}

export { getApiErrorMessage } from './apiErrors';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  username?: string;
  avatarUrl?: string | null;
  defaultCurrency: string;
  isAdmin?: boolean;
}

export interface DashboardData {
  totalBalance: number;
  totalCurrency?: string;
  groups: { id: string; name: string; color: string | null; currency?: string; balance: number }[];
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  groupId?: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  groupName: string;
  paidByName: string;
  date: string;
  userShare: number;
  userPaid: boolean;
}

export interface GroupSummary {
  id: string;
  name: string;
  color: string;
  currency: string;
  balance: number;
  memberCount: number;
  category?: string;
}

export interface GroupJoinPreview {
  groupId: string;
  name: string;
  category: string;
  currency: string;
  memberCount: number;
  isMember: boolean;
}

export interface GroupJoinResult {
  groupId: string;
  name: string;
  alreadyMember: boolean;
}

export interface GroupInviteInfo {
  groupId: string;
  groupName: string;
  inviteCode: string;
  link: string;
  message: string;
}

export interface GroupMember {
  userId?: string;
  role?: string;
  user: { id: string; name: string; email?: string; avatarUrl?: string | null };
}

export interface SimplifiedDebt {
  payerId: string;
  payeeId: string;
  amount: number;
}

export interface PairwiseDebt {
  fromId: string;
  toId: string;
  amount: number;
}

export interface MemberDebtSummary {
  userId: string;
  owes: { userId: string; amount: number }[];
  owedBy: { userId: string; amount: number }[];
}

export interface GroupDetail {
  id: string;
  name: string;
  color: string;
  currency: string;
  category: string;
  userBalance: number;
  balances: Record<string, number>;
  simplifiedDebts: SimplifiedDebt[];
  pairwiseDebts: PairwiseDebt[];
  memberDebtSummaries: MemberDebtSummary[];
  members: GroupMember[];
  expenses: GroupExpense[];
}

export interface GroupExpense {
  id: string;
  description: string;
  amount: number | string;
  currency: string;
  category: string;
  splitType?: string;
  date: string;
  receiptUrl?: string | null;
  paidBy: { id: string; name: string };
  splits: { userId: string; amount: number | string; user?: { name: string } }[];
}

export interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  group?: { id?: string; name: string };
  paidBy?: { id?: string; name: string };
  userShare?: number;
  userOwes?: boolean;
}

export interface CreateExpensePayload {
  groupId: string;
  description: string;
  amount: number;
  category: string;
  paidById: string;
  splitType: string;
  splits: { userId: string; amount: number }[];
  receiptUrl?: string;
  date?: string;
}

export interface SettlementPayload {
  payeeId: string;
  payerId?: string;
  amount: number;
  currency?: string;
  groupId?: string;
  note?: string;
  paymentRef?: string;
}

export interface SettlementItem {
  id: string;
  amount: number | string;
  currency: string;
  note?: string;
  paymentRef?: string;
  createdAt: string;
  payer: { id: string; name: string };
  payee: { id: string; name: string };
}

export interface ActivityFeedItem {
  id: string;
  sourceId: string;
  kind: 'expense' | 'settlement' | 'member';
  date: string;
  groupId: string | null;
  groupName: string | null;
  title: string;
  subtitle: string;
  category: string | null;
  amount: number;
  currency: string;
  userShare: number;
  userPaid: boolean;
  action?: string;
  diff?: Record<string, [unknown, unknown]>;
}

export interface ActivityFeed {
  items: ActivityFeedItem[];
  page: number;
  hasMore: boolean;
}

export interface FriendItem {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  balance: number;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

export interface NotificationPage {
  items: NotificationItem[];
  page: number;
  hasMore: boolean;
}

export interface CategoryReportItem {
  category: string;
  amount: number;
}

export interface MonthlyReportItem {
  month: string;
  amount: number;
  paid?: number;
}

export interface InsightItem {
  type: string;
  title: string;
  body: string;
  positive?: boolean;
}

// ─── Admin types ──────────────────────────────────────────────────────────────

export interface AdminStats {
  users: { total: number; verified: number; unverified: number; newToday: number; newThisWeek: number; newThisMonth: number };
  groups: { total: number };
  expenses: { total: number; totalAmount: number };
  settlements: { total: number };
}

export interface AdminAiStats {
  total: number;
  last24h: number;
  byProvider: { provider: string; count: number }[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  googleId: string | null;
  createdAt: string;
  deletedAt?: string | null;
  _count?: { groupMembers: number; expensesPaid: number };
}

export interface AdminUsersPage {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export const api = new ApiClient(API_URL);

// ─── Standalone admin API (uses same auth token) ──────────────────────────────

export const adminApi = {
  stats: (): Promise<AdminStats> => api.get('/admin/stats'),
  aiStats: (): Promise<AdminAiStats> => api.get('/admin/stats/ai'),
  recentSignups: (limit = 20): Promise<AdminUser[]> => api.get(`/admin/logs/signups?limit=${limit}`),
  recentLogins: (limit = 20): Promise<unknown[]> => api.get(`/admin/logs/logins?limit=${limit}`),
  listUsers: (page = 0, limit = 20, search?: string, status: 'all' | 'active' | 'deactivated' = 'all'): Promise<AdminUsersPage> =>
    api.get(`/admin/users?page=${page}&limit=${limit}&status=${status}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getUser: (id: string): Promise<AdminUser> => api.get(`/admin/users/${id}`),
  deactivateUser: (id: string): Promise<{ success: boolean }> => api.del(`/admin/users/${id}`),
  reactivateUser: (id: string): Promise<{ success: boolean }> => api.post(`/admin/users/${id}/reactivate`),
  purgeUser: (id: string): Promise<{ success: boolean; message: string }> => api.post(`/admin/users/${id}/purge`),
  sendVerification: (id: string): Promise<{ message: string }> => api.post(`/admin/users/${id}/send-verification`),
};
