import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { authenticateWithBiometric, isBiometricEnabled } from '../services/biometrics';

interface BiometricLockProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
}

export function BiometricLock({ children, isAuthenticated }: BiometricLockProps) {
  const theme = useTheme();
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setLocked(false);
      setChecking(false);
      return;
    }

    (async () => {
      const enabled = await isBiometricEnabled();
      if (!enabled) {
        setLocked(false);
        setChecking(false);
        return;
      }

      setLocked(true);
      setChecking(false);
      const ok = await authenticateWithBiometric();
      setLocked(!ok);
    })();
  }, [isAuthenticated]);

  const retry = async () => {
    const ok = await authenticateWithBiometric();
    setLocked(!ok);
  };

  if (!isAuthenticated || !locked) return <>{children}</>;

  if (checking) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
        <ActivityIndicator color={theme.colors.accent.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
      <Text style={[styles.title, { color: theme.colors.text.primary }]}>Unlock Split</Text>
      <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
        Use biometrics to access your account
      </Text>
      <Pressable style={[styles.button, { backgroundColor: theme.colors.accent.primary }]} onPress={retry}>
        <Text style={styles.buttonText}>Unlock</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 24 },
  button: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  buttonText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
});
