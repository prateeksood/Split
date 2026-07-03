import { ReactNode, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  Image,
  ViewStyle,
  TextStyle,
  StyleProp,
  TextInputProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

type IoniconName = keyof typeof Ionicons.glyphMap;

// react-native-web adds a default browser focus outline on TextInput; remove it
// so only our themed border shows. Harmless no-op on native.
export const noOutline = { outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle;

/* ---------------------------------------------------------------- Card --- */

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  padded?: boolean;
  onPress?: () => void;
}

export function Card({ children, style, elevation = 'sm', padded = true, onPress }: CardProps) {
  const theme = useTheme();
  const baseStyle: StyleProp<ViewStyle> = [
    {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border.hairline,
    },
    elevation !== 'none' ? theme.shadows[elevation] : null,
    padded ? { padding: theme.spacing.lg } : null,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [baseStyle, pressed ? styles.pressed : null]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={baseStyle}>{children}</View>;
}

/* -------------------------------------------------------- GradientCard --- */

interface GradientCardProps {
  children: ReactNode;
  colors?: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
  elevation?: 'none' | 'sm' | 'md' | 'lg' | 'glow';
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

export function GradientCard({
  children,
  colors,
  style,
  elevation = 'md',
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
}: GradientCardProps) {
  const theme = useTheme();
  const gradientColors = colors ?? theme.colors.gradient.brandVibrant;
  return (
    <View style={[{ borderRadius: theme.radius.xl }, elevation !== 'none' ? theme.shadows[elevation] : null, style]}>
      <LinearGradient
        colors={gradientColors}
        start={start}
        end={end}
        style={[styles.gradientInner, { borderRadius: theme.radius.xl }]}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

/* -------------------------------------------------------------- Avatar --- */

const AVATAR_GRADIENTS: [string, string][] = [
  ['#8B7CFF', '#6366F1'],
  ['#38BDF8', '#6366F1'],
  ['#34D399', '#10B981'],
  ['#FB7185', '#F43F5E'],
  ['#FBBF24', '#FB7185'],
  ['#22D3EE', '#3B82F6'],
  ['#A78BFA', '#EC4899'],
];

function hashIndex(seed: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % mod;
}

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ name, avatarUrl, size = 44, style }: AvatarProps) {
  const theme = useTheme();
  const [imgError, setImgError] = useState(false);
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
  const gradient = AVATAR_GRADIENTS[hashIndex(name || '?', AVATAR_GRADIENTS.length)];

  const containerStyle = [{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' as const }, styles.center, style];

  if (avatarUrl && !imgError) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: size, height: size }}
          onError={() => setImgError(true)}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={containerStyle}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontFamily: theme.typography.fontFamily.display,
          fontSize: size * 0.38,
        }}
      >
        {initials || '?'}
      </Text>
    </LinearGradient>
  );
}

/* ----------------------------------------------------------- AppButton --- */

interface AppButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  icon?: IoniconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: AppButtonProps) {
  const theme = useTheme();
  const height = size === 'lg' ? 56 : 48;
  const isDisabled = disabled || loading;

  const content = (color: string) => (
    <>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <View style={styles.btnRow}>
          {icon ? <Ionicons name={icon} size={size === 'lg' ? 20 : 18} color={color} /> : null}
          <Text
            style={{
              color,
              fontFamily: theme.typography.fontFamily.display,
              fontSize: size === 'lg' ? theme.typography.size.lg : theme.typography.size.base,
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </>
  );

  if (variant === 'primary') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          { height, borderRadius: theme.radius.lg, opacity: isDisabled ? 0.55 : 1 },
          fullWidth ? { alignSelf: 'stretch' } : null,
          theme.shadows.sm,
          pressed ? styles.pressed : null,
          style,
        ]}
      >
        <LinearGradient
          colors={theme.colors.gradient.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.btnInner, { height, borderRadius: theme.radius.lg }]}
        >
          {content(theme.colors.text.onAccent)}
        </LinearGradient>
      </Pressable>
    );
  }

  const bg =
    variant === 'secondary'
      ? theme.colors.accent.muted
      : variant === 'danger'
        ? theme.colors.accent.danger + '1F'
        : 'transparent';
  const fg =
    variant === 'danger'
      ? theme.colors.accent.danger
      : variant === 'ghost'
        ? theme.colors.accent.primary
        : theme.colors.text.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btnInner,
        {
          height,
          borderRadius: theme.radius.lg,
          backgroundColor: bg,
          opacity: isDisabled ? 0.55 : 1,
        },
        fullWidth ? { alignSelf: 'stretch' } : null,
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      {content(fg)}
    </Pressable>
  );
}

/* -------------------------------------------------------- ScreenHeader --- */

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  large?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ScreenHeader({ title, subtitle, large = false, onBack, right, style }: ScreenHeaderProps) {
  const theme = useTheme();
  return (
    <View style={[styles.headerRow, style]}>
      <View style={styles.headerLeft}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={[styles.backBtn, { backgroundColor: theme.colors.accent.muted }]}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
          </Pressable>
        ) : null}
        <View style={styles.headerTitleWrap}>
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.text.primary,
              fontFamily: large ? theme.typography.fontFamily.displayExtra : theme.typography.fontFamily.display,
              fontSize: large ? theme.typography.size['3xl'] : theme.typography.size.xl,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={{
                color: theme.colors.text.secondary,
                fontFamily: theme.typography.fontFamily.body,
                fontSize: theme.typography.size.sm,
                marginTop: 2,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

/* ----------------------------------------------------- HeaderIconButton --- */

export function HeaderIconButton({ icon, onPress, color }: { icon: IoniconName; onPress?: () => void; color?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconBtn,
        { backgroundColor: theme.colors.accent.muted },
        pressed ? styles.pressed : null,
      ]}
    >
      <Ionicons name={icon} size={20} color={color ?? theme.colors.text.primary} />
    </Pressable>
  );
}

/* ------------------------------------------------------- SectionHeader --- */

export function SectionHeader({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionTop}>
        <Text
          style={{
            color: theme.colors.text.primary,
            fontFamily: theme.typography.fontFamily.display,
            fontSize: theme.typography.size.lg,
          }}
        >
          {title}
        </Text>
        {actionLabel ? (
          <Pressable onPress={onAction} hitSlop={8}>
            <Text style={{ color: theme.colors.accent.primary, fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.size.sm }}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {hint ? (
        <Text style={{ color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body, fontSize: theme.typography.size.sm, marginTop: 2 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------- EmptyState --- */

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  message,
  ctaLabel,
  onCta,
}: {
  icon?: IoniconName;
  title: string;
  message?: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.emptyWrap}>
      <LinearGradient
        colors={theme.colors.gradient.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.emptyIcon}
      >
        <Ionicons name={icon} size={34} color="#FFFFFF" />
      </LinearGradient>
      <Text
        style={{
          color: theme.colors.text.primary,
          fontFamily: theme.typography.fontFamily.display,
          fontSize: theme.typography.size.lg,
          marginTop: theme.spacing.xl,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {message ? (
        <Text
          style={{
            color: theme.colors.text.secondary,
            fontFamily: theme.typography.fontFamily.body,
            fontSize: theme.typography.size.sm,
            textAlign: 'center',
            marginTop: theme.spacing.sm,
            lineHeight: theme.typography.lineHeight.sm,
            paddingHorizontal: theme.spacing['2xl'],
          }}
        >
          {message}
        </Text>
      ) : null}
      {ctaLabel ? (
        <AppButton label={ctaLabel} icon="add" onPress={onCta} style={{ marginTop: theme.spacing['2xl'], paddingHorizontal: theme.spacing['2xl'] }} />
      ) : null}
    </View>
  );
}

/* --------------------------------------------------------------- Chip --- */

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IoniconName;
}) {
  const theme = useTheme();
  const fg = selected ? theme.colors.text.onAccent : theme.colors.text.secondary;

  if (selected) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [pressed ? styles.pressed : null]}>
        <LinearGradient
          colors={theme.colors.gradient.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.chip, theme.shadows.sm]}
        >
          {icon ? <Ionicons name={icon} size={15} color={fg} style={{ marginRight: 6 }} /> : null}
          <Text style={{ color: fg, fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.size.sm }}>{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: theme.colors.accent.muted },
        pressed ? styles.pressed : null,
      ]}
    >
      {icon ? <Ionicons name={icon} size={15} color={fg} style={{ marginRight: 6 }} /> : null}
      <Text style={{ color: fg, fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.size.sm }}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------- AppTextInput --- */

interface AppTextInputProps extends TextInputProps {
  icon?: IoniconName;
  label?: string;
  rightSlot?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export function AppTextInput({ icon, label, rightSlot, containerStyle, style, onFocus, onBlur, ...props }: AppTextInputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={containerStyle}>
      {label ? (
        <Text style={{ color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.size.sm, marginBottom: 8 }}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: theme.colors.background.secondary,
            borderColor: focused ? theme.colors.accent.primary : theme.colors.border.hairline,
          },
        ]}
      >
        {icon ? <Ionicons name={icon} size={19} color={focused ? theme.colors.accent.primary : theme.colors.text.tertiary} style={{ marginRight: 10 }} /> : null}
        <TextInput
          placeholderTextColor={theme.colors.text.tertiary}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            { flex: 1, color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.body, fontSize: theme.typography.size.base, paddingVertical: 0 },
            noOutline,
            style,
          ]}
        />
        {rightSlot}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------- Pill --- */

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'danger' | 'brand' }) {
  const theme = useTheme();
  const map = {
    neutral: { bg: theme.colors.accent.muted, fg: theme.colors.text.secondary },
    success: { bg: theme.colors.accent.success + '22', fg: theme.colors.accent.success },
    danger: { bg: theme.colors.accent.danger + '22', fg: theme.colors.accent.danger },
    brand: { bg: theme.colors.accent.primary + '22', fg: theme.colors.accent.primary },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: map.bg }]}>
      <Text style={{ color: map.fg, fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.size.xs }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  center: { alignItems: 'center', justifyContent: 'center' },
  gradientInner: { padding: 20 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnInner: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerTitleWrap: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionWrap: { paddingHorizontal: 20, marginTop: 24, marginBottom: 12 },
  sectionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9999 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, alignSelf: 'flex-start' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
  },
});
