import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SUPPORTED_CURRENCIES } from '@split/shared';
import { useTheme, useThemeMode, useThemePalette, type ThemeMode } from '../theme/ThemeProvider';
import { ACCENT_PALETTES } from '../theme/tokens';
import { api, getApiErrorMessage } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { ScreenHeader, AppButton, Avatar, Chip, Card } from '../components/ui';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricEnabled,
} from '../services/biometrics';
import { registerForPushNotifications } from '../services/pushNotifications';

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { mode: 'light', label: 'Light', icon: 'sunny-outline' },
  { mode: 'dark', label: 'Dark', icon: 'moon-outline' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();
  const { palette: themePalette, setPalette: setThemePalette } = useThemePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const clearTokens = useAuthStore((s) => s.clearTokens);

  const [biometricAvail, setBiometricAvail] = useState(false);
  const [biometricOn, setBiometricOn] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencyError, setCurrencyError] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.users.me(),
  });

  const isAdmin = profile?.isAdmin === true;

  useEffect(() => {
    isBiometricAvailable().then(setBiometricAvail);
    isBiometricEnabled().then(setBiometricOn);
    registerForPushNotifications();
  }, []);

  const toggleBiometric = async (value: boolean) => {
    setBiometricOn(value);
    await setBiometricEnabled(value);
  };

  const handleCurrencyChange = async (currency: string) => {
    if (currency === profile?.defaultCurrency) return;
    setSavingCurrency(true);
    setCurrencyError('');
    try {
      await api.users.update({ defaultCurrency: currency });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e) {
      setCurrencyError(getApiErrorMessage(e));
    } finally {
      setSavingCurrency(false);
    }
  };

  const handleLogout = async () => {
    const { refreshToken } = useAuthStore.getState();
    try {
      await api.auth.logout(refreshToken ?? undefined);
    } catch {
      // Non-blocking — clear client tokens regardless.
    }
    await clearTokens();
    queryClient.clear();
    router.replace('/(auth)/login');
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background.primary }]}>
        <ActivityIndicator color={theme.colors.accent.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top }]}>
      <ScreenHeader title="Settings" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Card style={styles.profileCard} elevation="md">
          <Avatar name={profile?.name ?? 'You'} size={56} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[styles.name, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]}>{profile?.name}</Text>
            <Text style={{ color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }}>{profile?.email}</Text>
          </View>
        </Card>

        <Text style={[styles.sectionLabel, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>Appearance</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((opt) => (
            <Chip
              key={opt.mode}
              label={opt.label}
              icon={opt.icon}
              selected={themeMode === opt.mode}
              onPress={() => setThemeMode(opt.mode)}
            />
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium, marginTop: 16 }]}>Accent color</Text>
        <View style={styles.paletteRow}>
          {ACCENT_PALETTES.map((p) => {
            const selected = themePalette === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setThemePalette(p.id)}
                accessibilityLabel={p.label}
                style={[
                  styles.paletteSwatchOuter,
                  selected && { borderColor: p.color, borderWidth: 2.5 },
                ]}
              >
                <View style={[styles.paletteSwatch, { backgroundColor: p.color }]} />
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium, marginTop: 16 }]}>Default currency</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 8 }}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <Chip key={c} label={c} selected={profile?.defaultCurrency === c} onPress={() => handleCurrencyChange(c)} />
          ))}
        </ScrollView>
        {savingCurrency ? <ActivityIndicator color={theme.colors.accent.primary} style={{ alignSelf: 'flex-start', marginVertical: 4 }} /> : null}
        {currencyError ? <Text style={{ color: theme.colors.accent.danger, marginBottom: 8, fontFamily: theme.typography.fontFamily.body }}>{currencyError}</Text> : null}

        <Text style={[styles.sectionLabel, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium, marginTop: 12 }]}>Preferences</Text>

        <Row theme={theme} icon="bar-chart" iconColor="#38BDF8" label="Reports & Export" onPress={() => router.push('/reports')} />
        <Row theme={theme} icon="notifications" iconColor="#FBBF24" label="Notifications" onPress={() => router.push('/notifications')} />
        <Row theme={theme} icon="shield-checkmark" iconColor="#34D399" label="Privacy Policy" onPress={() => router.push('/privacy-policy')} />
        {isAdmin && (
          <Row theme={theme} icon="settings" iconColor="#FB7185" label="Admin Dashboard" onPress={() => router.push('/admin')} />
        )}

        {biometricAvail && (
          <View style={[styles.row, { backgroundColor: theme.colors.background.secondary, borderColor: theme.colors.border.hairline }]}>
            <View style={[styles.rowIcon, { backgroundColor: theme.colors.accent.primary + '22' }]}>
              <Ionicons name="finger-print" size={20} color={theme.colors.accent.primary} />
            </View>
            <Text style={[styles.rowText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Biometric login</Text>
            <Switch value={biometricOn} onValueChange={toggleBiometric} trackColor={{ true: theme.colors.accent.primary }} />
          </View>
        )}

        <AppButton label="Log out" icon="log-out-outline" variant="danger" onPress={handleLogout} fullWidth style={{ marginTop: 24 }} />
      </ScrollView>
    </View>
  );
}

function Row({
  theme,
  icon,
  iconColor,
  label,
  onPress,
}: {
  theme: ReturnType<typeof useTheme>;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        theme.shadows.sm,
        { backgroundColor: theme.colors.background.secondary, borderColor: theme.colors.border.hairline },
        pressed ? { opacity: 0.9 } : null,
      ]}
      onPress={onPress}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconColor + '22' }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[styles.rowText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  profileCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  name: { fontSize: 19, marginBottom: 3 },
  sectionLabel: { fontSize: 13, marginBottom: 10, marginTop: 4 },
  themeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  paletteSwatchOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paletteSwatch: { width: 28, height: 28, borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, marginBottom: 10, gap: 12, borderWidth: StyleSheet.hairlineWidth },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, fontSize: 15.5 },
});
