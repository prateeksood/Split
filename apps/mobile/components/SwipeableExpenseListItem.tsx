import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { impactLight } from '../services/haptics';
import { useTheme } from '../theme/ThemeProvider';
import { ExpenseListItem } from './ExpenseListItem';

interface SwipeableExpenseListItemProps {
  expenseId?: string;
  groupId?: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  groupName?: string;
  paidByName?: string;
  date: string;
  userShare: number;
  userPaid: boolean;
  onSettle?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function SwipeableExpenseListItem({
  expenseId,
  groupId,
  onSettle,
  onEdit,
  onDelete,
  ...itemProps
}: SwipeableExpenseListItemProps) {
  const theme = useTheme();

  const renderLeftActions = () => (
    <Pressable
      style={[styles.action, { backgroundColor: theme.colors.accent.success }]}
      onPress={() => {
        impactLight();
        onSettle?.();
      }}
    >
      <Ionicons name="checkmark-circle" size={22} color="#FFF" />
      <Text style={styles.actionText}>Settle</Text>
    </Pressable>
  );

  const renderRightActions = () => (
    <View style={styles.rightActions}>
      {onEdit ? (
        <Pressable
          style={[styles.action, { backgroundColor: theme.colors.accent.primary }]}
          onPress={() => {
            impactLight();
            onEdit();
          }}
        >
          <Ionicons name="pencil" size={22} color="#FFF" />
          <Text style={styles.actionText}>Edit</Text>
        </Pressable>
      ) : null}
      {onDelete ? (
        <Pressable
          style={[styles.action, { backgroundColor: theme.colors.accent.danger }]}
          onPress={() => {
            impactLight();
            onDelete();
          }}
        >
          <Ionicons name="trash" size={22} color="#FFF" />
          <Text style={styles.actionText}>Delete</Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (!onSettle && !onEdit && !onDelete) {
    return <ExpenseListItem {...itemProps} />;
  }

  return (
    <Swipeable
      renderLeftActions={onSettle ? renderLeftActions : undefined}
      renderRightActions={onEdit || onDelete ? renderRightActions : undefined}
      friction={2}
      overshootFriction={8}
    >
      <ExpenseListItem {...itemProps} onPress={onEdit} />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  rightActions: { flexDirection: 'row' },
  action: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    marginBottom: 10,
    marginHorizontal: 4,
    borderRadius: 18,
    gap: 4,
  },
  actionText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
});
