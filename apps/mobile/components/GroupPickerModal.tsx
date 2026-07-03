import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '@split/shared';
import { useTheme } from '../theme/ThemeProvider';
import { api, type GroupSummary } from '../services/api';
import { HeaderIconButton, Pill } from './ui';

interface GroupPickerModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onSelect: (group: GroupSummary) => void;
}

export function GroupPickerModal({
  visible,
  title = 'Select a group',
  subtitle = 'Expenses and AI parsing require a group for member validation.',
  onClose,
  onSelect,
}: GroupPickerModalProps) {
  const theme = useTheme();
  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.groups.list(),
    enabled: visible,
  });
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.users.me(),
    enabled: visible,
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.background.elevated }]}>
          <View style={[styles.grabber, { backgroundColor: theme.colors.border.hairline }]} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]}>{title}</Text>
            <HeaderIconButton icon="close" onPress={onClose} />
          </View>
          <Text style={[styles.subtitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>{subtitle}</Text>

          {isLoading ? (
            <ActivityIndicator color={theme.colors.accent.primary} style={{ marginVertical: 24 }} />
          ) : !groups?.length ? (
            <View style={styles.empty}>
              <Text style={{ color: theme.colors.text.secondary, textAlign: 'center', fontFamily: theme.typography.fontFamily.body }}>
                Create a group first, then add expenses from the group screen.
              </Text>
            </View>
          ) : (
            <FlatList
              data={groups}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 400 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.row,
                    theme.shadows.sm,
                    { backgroundColor: theme.colors.background.secondary, borderColor: theme.colors.border.hairline },
                    pressed ? { opacity: 0.9 } : null,
                  ]}
                  onPress={() => onSelect(item)}
                >
                  <LinearGradient colors={[item.color, item.color + 'CC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
                    <Text style={styles.badgeText}>{item.name.charAt(0).toUpperCase()}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.name, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]} numberOfLines={1}>{item.name}</Text>
                    <View style={{ marginTop: 5, flexDirection: 'row' }}>
                      <Pill label={`${item.memberCount} members`} />
                    </View>
                  </View>
                  <Text style={{ color: theme.colors.text.secondary, fontSize: 13, marginRight: 8, fontFamily: theme.typography.fontFamily.medium }}>
                    {formatCurrency(Math.abs(item.balance), profile?.defaultCurrency ?? 'USD')}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.text.tertiary} />
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32 },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontSize: 21 },
  subtitle: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  empty: { paddingVertical: 24, paddingHorizontal: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  name: { fontSize: 16 },
});
