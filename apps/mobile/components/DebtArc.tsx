import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { useAnimatedProps, withTiming, useSharedValue, withDelay } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useTheme } from '../theme/ThemeProvider';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface DebtArcProps {
  balance: number;
  maxBalance?: number;
  size?: number;
  children?: React.ReactNode;
}

export function DebtArc({ balance, maxBalance = 5000, size = 80, children }: DebtArcProps) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  const normalized = Math.min(Math.abs(balance) / maxBalance, 1);
  const isPositive = balance >= 0;
  const strokeWidth = 3;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    progress.value = withDelay(200, withTiming(normalized, { duration: 600 }));
  }, [normalized]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const strokeColor = isPositive ? theme.colors.accent.success : theme.colors.accent.danger;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={strokeColor} stopOpacity="1" />
            <Stop offset="100%" stopColor={isPositive ? '#10B981' : '#FF4444'} stopOpacity="0.6" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.border.hairline}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#arcGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
