import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { LoadingScreen } from '../components/LoadingScreen';

/** Initial route — avoids a blank stack while auth state loads. */
export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) return <Redirect href="/(tabs)" />;
  return <Redirect href="/(auth)/login" />;
}
