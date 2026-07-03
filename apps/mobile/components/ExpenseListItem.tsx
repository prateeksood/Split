import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, formatRelativeTime } from '@split/shared';
import { useTheme } from '../theme/ThemeProvider';

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Food: 'restaurant',
  Transport: 'car',
  Accommodation: 'bed',
  Entertainment: 'game-controller',
  Utilities: 'flash',
  Shopping: 'cart',
  Health: 'medical',
  Other: 'pricetag',
};

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#FB7185',
  Transport: '#38BDF8',
  Accommodation: '#8B7CFF',
  Entertainment: '#FBBF24',
  Utilities: '#34D399',
  Shopping: '#F472B6',
  Health: '#2DD4BF',
  Other: '#9A9AB0',
};

interface ExpenseListItemProps {
  description: string;
  category: string;
  amount: number;
  currency: string;
  groupName?: string;
  paidByName?: string;
  date: string;
  userShare: number;
  userPaid: boolean;
  onPress?: () => void;
}

export function ExpenseListItem({
  description,
  category,
  amount,
  currency,
  groupName,
  paidByName,
  date,
  userShare,
  userPaid,
  onPress,
}: ExpenseListItemProps) {
  const theme = useTheme();
  const icon = CATEGORY_ICONS[category] ?? 'pricetag';
  const accent = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other;
  const oweAmount = userPaid ? amount - userShare : userShare;
  const isOwed = userPaid;
  const shareColor = isOwed ? theme.colors.accent.success : theme.colors.accent.danger;

  const meta = [groupName, paidByName ? `paid by ${paidByName}` : null].filter(Boolean).join('  ·  ');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        theme.shadows.sm,
        { backgroundColor: theme.colors.background.secondary, borderColor: theme.colors.border.hairline },
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: accent + '22' }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[styles.description, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]} numberOfLines={1}>
            {description}
          </Text>
          <Text style={[styles.amount, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]}>
            {formatCurrency(amount, currency)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.meta, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]} numberOfLines={1}>
            {meta || formatRelativeTime(date)}
          </Text>
          <View style={[styles.sharePill, { backgroundColor: shareColor + '1F' }]}>
            <Text style={[styles.share, { color: shareColor, fontFamily: theme.typography.fontFamily.medium }]}>
              {isOwed ? `+${formatCurrency(oweAmount, currency)}` : `-${formatCurrency(userShare, currency)}`}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    marginBottom: 10,
    marginHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  description: { fontSize: 15, flex: 1, marginRight: 8 },
  amount: { fontSize: 15 },
  meta: { fontSize: 12.5, flex: 1, marginRight: 8 },
  sharePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  share: { fontSize: 12.5 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
