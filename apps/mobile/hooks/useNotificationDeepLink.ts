import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

export function useNotificationDeepLink() {
  const router = useRouter();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      if (!data) return;

      if (data.groupId && typeof data.groupId === 'string') {
        router.push({ pathname: '/group/[id]', params: { id: data.groupId } });
      } else if (data.type === 'expense_added') {
        router.push('/notifications');
      }
    });

    return () => sub.remove();
  }, [router]);
}
