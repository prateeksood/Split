import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { api, getApiErrorMessage } from '../services/api';
import { useRouteParam } from '../utils/routeParams';
import { useAuthStore } from '../stores/authStore';
import { notifySuccess } from '../services/haptics';
import { ScreenHeader, HeaderIconButton, AppButton, Card } from '../components/ui';

export default function InviteScreen() {
  const { ref: rawRef } = useLocalSearchParams<{ ref?: string | string[] }>();
  const ref = useRouteParam(rawRef);
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const accept = useCallback(async () => {
    if (!ref) {
      setStatus('error');
      setMessage('This invite link is missing a reference.');
      return;
    }
    setStatus('loading');
    try {
      const result = await api.friends.acceptInvite(ref);
      notifySuccess();
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      setStatus('done');
      setMessage(
        result.alreadyFriends
          ? `You are already friends with ${result.name}.`
          : `You are now friends with ${result.name}!`,
      );
    } catch (e) {
      setStatus('error');
      setMessage(getApiErrorMessage(e));
    }
  }, [ref, queryClient]);

  useEffect(() => {
    if (isAuthenticated && ref && status === 'idle') accept();
  }, [isAuthenticated, ref, status, accept]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top }]}>
      <ScreenHeader title="Friend invite" right={<HeaderIconButton icon="close" onPress={() => router.back()} />} />

      <View style={styles.body}>
        <LinearGradient colors={theme.colors.gradient.brandVibrant} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.badge, theme.shadows.glow]}>
          <Ionicons name="people" size={36} color="#FFFFFF" />
        </LinearGradient>

        {!isAuthenticated ? (
          <Card style={styles.card}>
            <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]}>Sign in to connect</Text>
            <Text style={[styles.text, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>
              Log in or create an account to accept this friend invite.
            </Text>
            <AppButton label="Go to sign in" onPress={() => router.replace('/(auth)/login')} fullWidth style={{ marginTop: 16 }} />
          </Card>
        ) : status === 'loading' || status === 'idle' ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.accent.primary} />
            <Text style={[styles.text, { color: theme.colors.text.secondary, marginTop: 12, fontFamily: theme.typography.fontFamily.body }]}>Accepting invite…</Text>
          </View>
        ) : (
          <Card style={styles.card}>
            <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]}>
              {status === 'done' ? 'Connected' : 'Could not accept'}
            </Text>
            <Text style={[styles.text, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>{message}</Text>
            <AppButton
              label={status === 'done' ? 'View friends' : 'Try again'}
              onPress={status === 'done' ? () => router.replace('/(tabs)/friends') : accept}
              fullWidth
              style={{ marginTop: 16 }}
            />
          </Card>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  badge: { width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  card: { width: '100%', alignItems: 'center' },
  center: { alignItems: 'center' },
  title: { fontSize: 20, marginBottom: 8, textAlign: 'center' },
  text: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
