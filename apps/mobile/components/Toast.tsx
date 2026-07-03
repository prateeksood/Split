import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { getApiErrorMessage } from '../services/apiErrors';

export type ToastType = 'error' | 'success' | 'info';

type ShowToast = (message: string, type?: ToastType) => void;

const ToastContext = createContext<ShowToast>(() => {});

const AUTO_DISMISS_MS = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('error');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -12, duration: 200, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  }, [opacity, translateY]);

  const showToast = useCallback(
    (msg: string, toastType: ToastType = 'error') => {
      if (!msg.trim()) return;
      if (timerRef.current) clearTimeout(timerRef.current);

      setMessage(msg);
      setType(toastType);
      setVisible(true);
      opacity.setValue(0);
      translateY.setValue(-12);

      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();

      timerRef.current = setTimeout(hide, AUTO_DISMISS_MS);
    },
    [hide, opacity, translateY],
  );

  const accentColor =
    type === 'success'
      ? theme.colors.accent.success
      : type === 'info'
        ? theme.colors.accent.primary
        : theme.colors.accent.danger;

  const iconName =
    type === 'success' ? 'checkmark-circle' : type === 'info' ? 'information-circle' : 'alert-circle';

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {visible ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrapper,
            {
              top: insets.top + 8,
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <Pressable
            onPress={hide}
            style={[
              styles.toast,
              {
                backgroundColor: theme.colors.background.secondary,
                borderColor: accentColor,
                shadowColor: theme.colors.background.primary,
              },
            ]}
          >
            <Ionicons name={iconName} size={20} color={accentColor} />
            <Text style={[styles.text, { color: theme.colors.text.primary }]}>{message}</Text>
            <Ionicons name="close" size={16} color={theme.colors.text.secondary} />
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const showToast = useContext(ToastContext);

  return {
    showToast,
    showError: (message: string) => showToast(message, 'error'),
    showSuccess: (message: string) => showToast(message, 'success'),
    showInfo: (message: string) => showToast(message, 'info'),
    showApiError: (error: unknown) => showToast(getApiErrorMessage(error), 'error'),
  };
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});
