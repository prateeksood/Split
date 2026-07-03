import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  const theme = useTheme();

  return (
    <View style={[styles.banner, { backgroundColor: theme.colors.accent.danger + '22', borderColor: theme.colors.accent.danger }]}>
      <Ionicons name="alert-circle" size={18} color={theme.colors.accent.danger} />
      <Text style={[styles.text, { color: theme.colors.accent.danger }]}>{message}</Text>
      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={18} color={theme.colors.accent.danger} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  text: { flex: 1, fontSize: 13, lineHeight: 18 },
});
