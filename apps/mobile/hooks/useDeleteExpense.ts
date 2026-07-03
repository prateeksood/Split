import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '../services/api';
import { invalidateExpenseData } from '../utils/queryInvalidation';
import { confirm, alertError } from '../utils/confirm';

export function useDeleteExpense(groupId?: string) {
  const queryClient = useQueryClient();

  const deleteExpense = useCallback(
    (expenseId: string, description?: string, expenseGroupId?: string, onDeleted?: () => void) => {
      confirm(
        'Delete expense?',
        description
          ? `"${description}" will be hidden from the group. It is kept for audit purposes.`
          : 'This expense will be hidden from the group but kept for audit purposes.',
        async () => {
          try {
            await api.expenses.delete(expenseId);
            invalidateExpenseData(queryClient, expenseGroupId ?? groupId);
            onDeleted?.();
          } catch (e) {
            alertError('Could not delete', getApiErrorMessage(e));
          }
        },
      );
    },
    [queryClient, groupId],
  );

  return { deleteExpense };
}
