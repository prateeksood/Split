import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { parseInviteCodeFromInput } from '@split/shared';
import { useTheme } from '../theme/ThemeProvider';
import { api, getApiErrorMessage, type GroupJoinPreview } from '../services/api';
import { useRouteParam } from '../utils/routeParams';
import { notifySuccess } from '../services/haptics';
import { useAuthStore } from '../stores/authStore';
import { ScreenHeader, HeaderIconButton, AppButton, AppTextInput, Card, Pill } from '../components/ui';
import { QRScanner } from '../components/QRScanner';

export default function JoinGroupScreen() {
  const { code: rawCode } = useLocalSearchParams<{ code?: string | string[] }>();
  const paramCode = useRouteParam(rawCode);
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [input, setInput] = useState(paramCode ?? '');
  const [preview, setPreview] = useState<GroupJoinPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  const resolvedCode = parseInviteCodeFromInput(input);

  const loadPreview = useCallback(async (code: string) => {
    setPreviewLoading(true);
    setError('');
    try {
      const result = await api.groups.previewJoin(code);
      setPreview(result);
    } catch (e) {
      setPreview(null);
      setError(getApiErrorMessage(e));
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (paramCode) {
      setInput(paramCode);
      loadPreview(paramCode);
    }
  }, [paramCode, loadPreview]);

  const handleLookup = () => {
    if (!resolvedCode) {
      setError('Enter a valid invite code or paste an invite link');
      setPreview(null);
      return;
    }
    loadPreview(resolvedCode);
  };

  const handleJoin = async () => {
    if (!resolvedCode) {
      setError('Enter a valid invite code or paste an invite link');
      return;
    }

    setJoinLoading(true);
    setError('');
    try {
      const result = await api.groups.join(resolvedCode);
      notifySuccess();
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      router.replace({ pathname: '/group/[id]', params: { id: result.groupId } });
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top }]}>
      <ScreenHeader
        title="Join group"
        subtitle="Enter an invite code or link"
        right={<HeaderIconButton icon="close" onPress={() => router.back()} />}
      />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!isAuthenticated ? (
          <Card style={{ marginBottom: 16 }}>
            <Text style={[styles.previewName, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]}>Sign in to join</Text>
            <Text style={{ color: theme.colors.text.secondary, marginTop: 8, lineHeight: 20, fontFamily: theme.typography.fontFamily.body }}>
              Log in or create an account, then open this invite link again or enter the code below.
            </Text>
            <AppButton label="Go to sign in" onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 16 }} />
          </Card>
        ) : null}

        <AppTextInput
          label="Invite code or link"
          icon="ticket-outline"
          value={input}
          onChangeText={(text) => {
            setInput(text);
            setPreview(null);
            setError('');
          }}
          placeholder="e.g. GOATRIP1 or split://join..."
          autoCapitalize="characters"
          autoCorrect={false}
          onSubmitEditing={handleLookup}
        />

        <AppButton
          label="Look up group"
          variant="secondary"
          icon="search-outline"
          loading={previewLoading}
          onPress={handleLookup}
          disabled={!input.trim() || !isAuthenticated}
          fullWidth
          style={{ marginTop: 12 }}
        />

        <AppButton
          label="Scan QR code"
          variant="ghost"
          icon="qr-code-outline"
          onPress={() => setShowScanner(true)}
          disabled={!isAuthenticated}
          fullWidth
          style={{ marginTop: 8 }}
        />

        {preview ? (
          <Card style={{ marginTop: 16 }} elevation="md">
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <LinearGradient colors={theme.colors.gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.previewBadge}>
                <Text style={styles.previewBadgeText}>{preview.name.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.previewName, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]}>{preview.name}</Text>
                <Text style={{ color: theme.colors.text.secondary, fontSize: 13, marginTop: 3, fontFamily: theme.typography.fontFamily.body }}>
                  {preview.category} · {preview.memberCount} members · {preview.currency}
                </Text>
              </View>
            </View>
            {preview.isMember ? (
              <View style={{ marginTop: 14 }}>
                <Pill label="You are already in this group" tone="success" />
              </View>
            ) : null}
          </Card>
        ) : null}

        {error ? <Text style={{ color: theme.colors.accent.danger, marginTop: 14, fontFamily: theme.typography.fontFamily.body }}>{error}</Text> : null}

        <AppButton
          label={preview?.isMember ? 'Open group' : 'Join group'}
          size="lg"
          loading={joinLoading}
          onPress={preview?.isMember ? () => router.replace({ pathname: '/group/[id]', params: { id: preview.groupId } }) : handleJoin}
          disabled={!resolvedCode || !isAuthenticated}
          fullWidth
          style={{ marginTop: 20 }}
        />
      </ScrollView>

      <QRScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={(data) => {
          setShowScanner(false);
          setInput(data);
          setPreview(null);
          setError('');
          const code = parseInviteCodeFromInput(data);
          if (code) loadPreview(code);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  previewName: { fontSize: 18 },
  previewBadge: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  previewBadgeText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
});
