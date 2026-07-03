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
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { api, getApiErrorMessage } from '../../services/api';
import { useRouteParam } from '../../utils/routeParams';
import { AppButton, AppTextInput } from '../../components/ui';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token: urlTokenParam } = useLocalSearchParams<{ token?: string | string[] }>();
  const urlToken = useRouteParam(urlTokenParam);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'reset'>(urlToken ? 'reset' : 'email');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (urlToken) {
      setToken(urlToken);
      setStep('reset');
    }
  }, [urlToken]);

  const handleRequest = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.auth.forgotPassword(email);
      setMessage(`${res.message} Check your email for the reset link.`);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    setError('');
    try {
      await api.auth.resetPassword(token, password);
      router.replace('/(auth)/login');
    } catch (e) {
      setError(getApiErrorMessage(e));
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
            <Ionicons name="key" size={28} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.displayExtra }]}>
            {step === 'email' ? 'Reset password' : 'Set new password'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>
            {step === 'email' ? 'We will send you a reset link' : 'Enter the token and your new password'}
          </Text>
        </View>

        {step === 'email' ? (
          <>
            <AppTextInput
              icon="mail-outline"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {message ? <Text style={{ color: theme.colors.accent.success, marginTop: 12, fontFamily: theme.typography.fontFamily.body }}>{message}</Text> : null}
            <AppButton label="Send reset link" size="lg" loading={loading} onPress={handleRequest} fullWidth style={{ marginTop: 16 }} />
          </>
        ) : (
          <>
            <AppTextInput icon="ticket-outline" placeholder="Reset token" value={token} onChangeText={setToken} containerStyle={{ marginBottom: 12 }} />
            <AppTextInput icon="lock-closed-outline" placeholder="New password" value={password} onChangeText={setPassword} secureTextEntry />
            <AppButton label="Update password" size="lg" loading={loading} onPress={handleReset} fullWidth style={{ marginTop: 16 }} />
          </>
        )}

        {error ? <Text style={[styles.error, { color: theme.colors.accent.danger, fontFamily: theme.typography.fontFamily.body }]}>{error}</Text> : null}

        <Link href="/(auth)/login" asChild>
          <Pressable>
            <Text style={[styles.link, { color: theme.colors.accent.primary, fontFamily: theme.typography.fontFamily.medium }]}>Back to login</Text>
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
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 6 },
  link: { textAlign: 'center', marginTop: 20, fontSize: 15 },
  error: { fontSize: 13, marginTop: 12, textAlign: 'center' },
});
