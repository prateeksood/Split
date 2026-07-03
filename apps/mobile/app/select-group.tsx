import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '@split/shared';
import { useTheme } from '../theme/ThemeProvider';
import { api } from '../services/api';
import { ScreenHeader, HeaderIconButton, EmptyState, Pill } from '../components/ui';

export default function SelectGroupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.groups.list(),
  });
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.users.me(),
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top }]}>
      <ScreenHeader
        title="Select group"
        subtitle="Where does this expense belong?"
        right={<HeaderIconButton icon="close" onPress={() => router.back()} />}
      />

      {isLoading ? (
        <ActivityIndicator color={theme.colors.accent.primary} style={{ marginTop: 32 }} />
      ) : !groups?.length ? (
        <EmptyState
          icon="people-outline"
          title="No groups yet"
          message="You need a group before adding expenses."
          ctaLabel="Go to Groups"
          onCta={() => router.replace('/(tabs)/groups')}
        />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                theme.shadows.sm,
                { backgroundColor: theme.colors.background.secondary, borderColor: theme.colors.border.hairline },
                pressed ? styles.pressed : null,
              ]}
              onPress={() =>
                router.replace({
                  pathname: '/add-expense',
                  params: { groupId: item.id },
                })
              }
            >
              <LinearGradient colors={[item.color, item.color + 'CC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
                <Text style={styles.badgeText}>{item.name.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={{ marginTop: 6, flexDirection: 'row' }}>
                  <Pill label={`${item.memberCount} members`} />
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  name: { fontSize: 16 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
