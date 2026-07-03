import { useEffect } from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const theme = useTheme();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.35, 0.7]),
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.background.tertiary,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function SkeletonExpenseItem() {
  const theme = useTheme();
  return (
    <View style={[styles.expenseItem, { backgroundColor: theme.colors.background.secondary }]}>
      <Skeleton width={44} height={44} borderRadius={14} />
      <View style={styles.expenseContent}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="50%" height={12} style={{ marginTop: 8 }} />
      </View>
      <Skeleton width={56} height={14} />
    </View>
  );
}

export function SkeletonGroupCard() {
  const theme = useTheme();
  return (
    <View style={[styles.groupCard, { backgroundColor: theme.colors.background.secondary }]}>
      <Skeleton width="60%" height={16} />
      <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
      <Skeleton width={72} height={18} style={{ marginTop: 12, alignSelf: 'flex-end' }} />
    </View>
  );
}

export function SkeletonFriendCard() {
  const theme = useTheme();
  return (
    <View style={[styles.friendCard, { backgroundColor: theme.colors.background.secondary }]}>
      <Skeleton width={40} height={40} borderRadius={20} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="70%" height={12} style={{ marginTop: 6 }} />
      </View>
      <Skeleton width={48} height={16} />
    </View>
  );
}

export function SkeletonHeroCard() {
  const theme = useTheme();
  return (
    <View style={[styles.hero, { backgroundColor: theme.colors.background.secondary }]}>
      <Skeleton width="40%" height={12} />
      <Skeleton width="50%" height={36} style={{ marginTop: 12 }} />
      <Skeleton width="35%" height={12} style={{ marginTop: 8 }} />
      <View style={styles.heroActions}>
        <Skeleton width="48%" height={40} borderRadius={12} />
        <Skeleton width="48%" height={40} borderRadius={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    marginHorizontal: 20,
    gap: 12,
  },
  expenseContent: { flex: 1 },
  groupCard: {
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
  },
  hero: {
    marginHorizontal: 20,
    borderRadius: 28,
    padding: 22,
    minHeight: 200,
  },
  heroActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
});
