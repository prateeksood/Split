import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '@split/shared';
import { useTheme } from '../theme/ThemeProvider';

interface GroupCardProps {
  id: string;
  name: string;
  balance: number;
  color: string;
  currency?: string;
  onPress?: () => void;
}

function tintPair(color: string): [string, string] {
  return [color, color + 'CC'];
}

export function GroupCard({ name, balance, color, currency = 'INR', onPress }: GroupCardProps) {
  const theme = useTheme();
  const isOwed = balance >= 0;
  const isSettled = Math.abs(balance) < 0.01;
  const statusColor = isSettled
    ? theme.colors.text.secondary
    : isOwed
      ? theme.colors.accent.success
      : theme.colors.accent.danger;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        theme.shadows.md,
        { backgroundColor: theme.colors.background.secondary, borderColor: theme.colors.border.hairline },
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.topRow}>
        <LinearGradient colors={tintPair(color)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconBadge}>
          <Text style={styles.iconText}>{name.charAt(0).toUpperCase()}</Text>
        </LinearGradient>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      </View>

      <Text style={[styles.name, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]} numberOfLines={1}>
        {name}
      </Text>
      <Text
        style={[styles.balance, { color: statusColor, fontFamily: theme.typography.fontFamily.display }]}
        numberOfLines={1}
      >
        {isSettled ? formatCurrency(0, currency) : formatCurrency(Math.abs(balance), currency)}
      </Text>
      <Text style={[styles.label, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>
        {isSettled ? 'settled up' : isOwed ? 'you are owed' : 'you owe'}
      </Text>
    </Pressable>
  );
}

interface GroupCardListProps {
  groups: { id: string; name: string; balance: number; color: string; currency?: string }[];
  currency?: string;
  onGroupPress?: (id: string) => void;
}

export function GroupCardList({ groups, currency, onGroupPress }: GroupCardListProps) {
  if (groups.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
      {groups.map((g) => (
        <GroupCard key={g.id} {...g} currency={g.currency ?? currency} onPress={() => onGroupPress?.(g.id)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, gap: 12, paddingBottom: 8, paddingTop: 2 },
  card: {
    width: 168,
    borderRadius: 20,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  iconBadge: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  name: { fontSize: 15, marginBottom: 6 },
  balance: { fontSize: 22, letterSpacing: -0.3 },
  label: { fontSize: 12, marginTop: 3 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
});
