import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { getTheme, Theme, ColorScheme, AccentPalette } from './tokens';
import { getSecureItem, setSecureItem } from '../services/secureStorage';

export type ThemeMode = 'system' | 'light' | 'dark';

const MODE_KEY = 'themeMode';
const PALETTE_KEY = 'themePalette';

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  scheme: ColorScheme;
  palette: AccentPalette;
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: AccentPalette) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: getTheme('dark', 'purple'),
  mode: 'system',
  scheme: 'dark',
  palette: 'purple',
  setMode: () => {},
  setPalette: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [palette, setPaletteState] = useState<AccentPalette>('purple');

  useEffect(() => {
    Promise.all([getSecureItem(MODE_KEY), getSecureItem(PALETTE_KEY)]).then(([storedMode, storedPalette]) => {
      if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
        setModeState(storedMode);
      }
      if (storedPalette === 'purple' || storedPalette === 'emerald' || storedPalette === 'blue' || storedPalette === 'orange' || storedPalette === 'rose') {
        setPaletteState(storedPalette);
      }
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    void setSecureItem(MODE_KEY, next);
  };

  const setPalette = (next: AccentPalette) => {
    setPaletteState(next);
    void setSecureItem(PALETTE_KEY, next);
  };

  const scheme: ColorScheme =
    mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: getTheme(scheme, palette), mode, scheme, palette, setMode, setPalette }),
    [scheme, mode, palette],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext).theme;
}

export function useThemeMode() {
  const { mode, scheme, setMode } = useContext(ThemeContext);
  return { mode, scheme, setMode };
}

export function useThemePalette() {
  const { palette, setPalette } = useContext(ThemeContext);
  return { palette, setPalette };
}
