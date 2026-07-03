import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '@split/shared';
import { useTheme } from '../theme/ThemeProvider';

interface BalanceHeroCardProps {
  totalBalance: number;
  currency?: string;
  userName?: string;
  onSettleUp?: () => void;
  onAddExpense?: () => void;
}

export function BalanceHeroCard({
  totalBalance,
  currency = 'INR',
  onSettleUp,
  onAddExpense,
}: BalanceHeroCardProps) {
  const theme = useTheme();
  const isOwed = totalBalance >= 0;
  const isSettled = Math.abs(totalBalance) < 0.01;

  return (
    <View style={[styles.wrapper, theme.shadows.lg]}>
      <LinearGradient
        colors={theme.colors.gradient.brandVibrant}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* decorative circles */}
        <View style={styles.blobTop} />
        <View style={styles.blobBottom} />

        <View style={styles.statusRow}>
          <View style={styles.statusPill}>
            <Ionicons
              name={isSettled ? 'checkmark-circle' : isOwed ? 'arrow-down-circle' : 'arrow-up-circle'}
              size={14}
              color="#FFFFFF"
            />
            <Text style={[styles.statusText, { fontFamily: theme.typography.fontFamily.medium }]}>
              {isSettled ? 'All settled' : isOwed ? 'You are owed' : 'You owe'}
            </Text>
          </View>
        </View>

        <Text style={[styles.label, { fontFamily: theme.typography.fontFamily.body }]}>Total balance</Text>
        <Text style={[styles.amount, { fontFamily: theme.typography.fontFamily.displayExtra }]}>
          {formatCurrency(Math.abs(totalBalance), currency)}
        </Text>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.button, styles.frosted, pressed ? styles.pressed : null]}
            onPress={onSettleUp}
          >
            <Ionicons name="swap-horizontal" size={18} color="#FFFFFF" />
            <Text style={[styles.frostedText, { fontFamily: theme.typography.fontFamily.display }]}>Settle Up</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.button, styles.solid, pressed ? styles.pressed : null]}
            onPress={onAddExpense}
          >
            <Ionicons name="add" size={20} color={theme.colors.accent.primaryDark} />
            <Text style={[styles.solidText, { color: theme.colors.accent.primaryDark, fontFamily: theme.typography.fontFamily.display }]}>
              Add Expense
            </Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 20, borderRadius: 28, marginBottom: 8 },
  card: { borderRadius: 28, padding: 22, overflow: 'hidden' },
  blobTop: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  blobBottom: {
    position: 'absolute',
    bottom: -60,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statusRow: { flexDirection: 'row' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  statusText: { color: '#FFFFFF', fontSize: 12 },
  label: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 16 },
  amount: { color: '#FFFFFF', fontSize: 42, lineHeight: 50, marginTop: 2, letterSpacing: -0.5 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  button: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: 14 },
  frosted: { backgroundColor: 'rgba(255,255,255,0.18)' },
  frostedText: { color: '#FFFFFF', fontSize: 15 },
  solid: { backgroundColor: '#FFFFFF' },
  solidText: { fontSize: 15 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
