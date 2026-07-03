import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { api, getApiErrorMessage } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useRouteParam } from '../../utils/routeParams';
import { AppButton, AppTextInput } from '../../components/ui';

export default function VerifyEmailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);
  const { token: rawToken, email: rawEmail } = useLocalSearchParams<{ token?: string | string[]; email?: string | string[] }>();
  const urlToken = useRouteParam(rawToken);
  const email = useRouteParam(rawEmail);

  const [token, setToken] = useState(urlToken ?? '');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const verify = useCallback(
    async (value: string) => {
      if (!value.trim()) {
        setError('Enter the verification code from your email.');
        return;
      }
      setVerifying(true);
      setError('');
      try {
        const tokens = await api.auth.verifyEmail(value.trim());
        await setTokens(tokens.accessToken, tokens.refreshToken);
        router.replace('/(tabs)');
      } catch (e) {
        setError(getApiErrorMessage(e));
      } finally {
        setVerifying(false);
      }
    },
    [router, setTokens],
  );

  useEffect(() => {
    if (urlToken) {
      setToken(urlToken);
      verify(urlToken);
    }
  }, [urlToken, verify]);

  const handleResend = async () => {
    if (!email) {
      setError('Open this screen from sign-up or your email link to resend.');
      return;
    }
    setResending(true);
    setError('');
    try {
      const res = await api.auth.resendVerification(email);
      setMessage(res.message);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.brand}>
          <LinearGradient colors={theme.colors.gradient.brandVibrant} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.logoBadge, theme.shadows.glow]}>
            <Ionicons name="mail-unread" size={30} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.displayExtra }]}>Verify your email</Text>
          <Text style={[styles.subtitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>
            {email ? `We sent a verification link to ${email}. Open it on this device, or enter the code below.` : 'Enter the verification code from your email to finish signing up.'}
          </Text>
        </View>

        {verifying && urlToken ? (
          <View style={{ alignItems: 'center', marginVertical: 12 }}>
            <ActivityIndicator color={theme.colors.accent.primary} />
            <Text style={{ color: theme.colors.text.secondary, marginTop: 12, fontFamily: theme.typography.fontFamily.body }}>Verifying…</Text>
          </View>
        ) : (
          <>
            <AppTextInput
              icon="key-outline"
              placeholder="Verification code"
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <AppButton label="Verify email" size="lg" loading={verifying} onPress={() => verify(token)} fullWidth style={{ marginTop: 16 }} />
            <Pressable onPress={handleResend} disabled={resending} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.accent.primary, fontFamily: theme.typography.fontFamily.medium }}>
                {resending ? 'Sending…' : 'Resend verification email'}
              </Text>
            </Pressable>
          </>
        )}

        {message ? <Text style={{ color: theme.colors.accent.success, marginTop: 14, textAlign: 'center', fontFamily: theme.typography.fontFamily.body }}>{message}</Text> : null}
        {error ? <Text style={{ color: theme.colors.accent.danger, marginTop: 14, textAlign: 'center', fontFamily: theme.typography.fontFamily.body }}>{error}</Text> : null}

        <Link href="/(auth)/login" asChild>
          <Pressable>
            <Text style={[styles.link, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>Back to login</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: 32 },
  logoBadge: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 24, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20, paddingHorizontal: 8 },
  link: { textAlign: 'center', marginTop: 24, fontSize: 15 },
});
