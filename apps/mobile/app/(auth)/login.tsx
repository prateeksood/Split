import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { api, getApiErrorMessage } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { isBiometricEnabled, authenticateWithBiometric, isBiometricAvailable } from '../../services/biometrics';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { AppButton, AppTextInput } from '../../components/ui';

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleToken = async (idToken: string) => {
    setError('');
    setGoogleLoading(true);
    try {
      const tokens = await api.auth.google(idToken);
      await setTokens(tokens.accessToken, tokens.refreshToken);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleTokens = async (tokens: { accessToken: string; refreshToken: string }) => {
    setError('');
    setGoogleLoading(true);
    try {
      await setTokens(tokens.accessToken, tokens.refreshToken);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const enabled = await isBiometricEnabled();
      const available = await isBiometricAvailable();
      const hasTokens = useAuthStore.getState().isAuthenticated;
      if (enabled && available && hasTokens) {
        const ok = await authenticateWithBiometric();
        if (ok) return;
      }
    })();
  }, []);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const tokens = await api.auth.login(email, password);
      await setTokens(tokens.accessToken, tokens.refreshToken);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      if (msg === 'EMAIL_NOT_VERIFIED') {
        router.replace({ pathname: '/(auth)/verify-email', params: { email } });
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
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
            <Ionicons name="cash" size={34} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.logo, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.displayExtra }]}>Split</Text>
          <Text style={[styles.subtitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>
            AI-powered expense splitting
          </Text>
        </View>

        <AppTextInput
          icon="mail-outline"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          containerStyle={{ marginBottom: 12 }}
        />
        <AppTextInput
          icon="lock-closed-outline"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? <Text style={[styles.error, { color: theme.colors.accent.danger, fontFamily: theme.typography.fontFamily.body }]}>{error}</Text> : null}

        <AppButton label="Sign In" size="lg" loading={loading} onPress={handleLogin} fullWidth style={{ marginTop: 16 }} />

        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: theme.colors.border.hairline }]} />
          <Text style={[styles.dividerText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.body }]}>or</Text>
          <View style={[styles.divider, { backgroundColor: theme.colors.border.hairline }]} />
        </View>

        <GoogleSignInButton
          onIdToken={handleGoogleToken}
          onTokens={handleGoogleTokens}
          onError={setError}
          disabled={loading || googleLoading}
        />

        <Link href="/(auth)/register" asChild>
          <Pressable>
            <Text style={[styles.link, { color: theme.colors.accent.primary, fontFamily: theme.typography.fontFamily.medium }]}>
              Create an account
            </Text>
          </Pressable>
        </Link>

        <Link href="/(auth)/forgot-password" asChild>
          <Pressable>
            <Text style={[styles.link, { color: theme.colors.text.secondary, marginTop: 12, fontFamily: theme.typography.fontFamily.body }]}>
              Forgot password?
            </Text>
          </Pressable>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: 36 },
  logoBadge: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  logo: { fontSize: 38, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: 6 },
  link: { textAlign: 'center', marginTop: 20, fontSize: 15 },
  error: { fontSize: 13, marginTop: 12 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 13 },
});
