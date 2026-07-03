import type { QueryClient } from '@tanstack/react-query';

/** Invalidate caches that should refresh after expense or settlement changes. */
export function invalidateExpenseData(queryClient: QueryClient, groupId?: string) {
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['groups'] });
  queryClient.invalidateQueries({ queryKey: ['expenses', 'recent'] });
  queryClient.invalidateQueries({ queryKey: ['settlements'] });
  queryClient.invalidateQueries({ queryKey: ['friends'] });
  if (groupId) {
    queryClient.invalidateQueries({ queryKey: ['group', groupId] });
  }
}
