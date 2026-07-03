// ─── Accent Palettes ──────────────────────────────────────────────────────────
// Each palette defines the brand/accent layer. Background, text, and border
// tokens stay fixed per light/dark scheme; only accents change per palette.

export type AccentPalette = 'purple' | 'emerald' | 'blue' | 'orange' | 'rose';

interface AccentColors {
  primary: string;
  primaryDark: string;
  secondary: string;
  success: string;
  danger: string;
  warning: string;
  muted: string;
  mutedStrong: string;
  gradient: {
    brand: [string, string];
    brandVibrant: [string, string, string];
    success: [string, string];
    danger: [string, string];
    sky: [string, string];
    sunset: [string, string];
    surface: [string, string];
  };
}

const accentPalettesDark: Record<AccentPalette, AccentColors> = {
  purple: {
    primary: '#8B7CFF',
    primaryDark: '#6355E8',
    secondary: '#22D3EE',
    success: '#34D399',
    danger: '#FB7185',
    warning: '#FBBF24',
    muted: '#2A2740',
    mutedStrong: '#352F52',
    gradient: {
      brand: ['#8B7CFF', '#6355E8'],
      brandVibrant: ['#A78BFA', '#6366F1', '#4F46E5'],
      success: ['#34D399', '#10B981'],
      danger: ['#FB7185', '#F43F5E'],
      sky: ['#38BDF8', '#6366F1'],
      sunset: ['#FB7185', '#FBBF24'],
      surface: ['#1B1B27', '#13131C'],
    },
  },
  emerald: {
    primary: '#10B981',
    primaryDark: '#059669',
    secondary: '#38BDF8',
    success: '#34D399',
    danger: '#FB7185',
    warning: '#FBBF24',
    muted: '#0D2620',
    mutedStrong: '#134030',
    gradient: {
      brand: ['#10B981', '#059669'],
      brandVibrant: ['#34D399', '#10B981', '#047857'],
      success: ['#34D399', '#10B981'],
      danger: ['#FB7185', '#F43F5E'],
      sky: ['#38BDF8', '#10B981'],
      sunset: ['#34D399', '#38BDF8'],
      surface: ['#0D1A14', '#080F0B'],
    },
  },
  blue: {
    primary: '#3B82F6',
    primaryDark: '#2563EB',
    secondary: '#06B6D4',
    success: '#34D399',
    danger: '#FB7185',
    warning: '#FBBF24',
    muted: '#0D1829',
    mutedStrong: '#152540',
    gradient: {
      brand: ['#3B82F6', '#2563EB'],
      brandVibrant: ['#60A5FA', '#3B82F6', '#06B6D4'],
      success: ['#34D399', '#10B981'],
      danger: ['#FB7185', '#F43F5E'],
      sky: ['#06B6D4', '#3B82F6'],
      sunset: ['#3B82F6', '#06B6D4'],
      surface: ['#0A1020', '#050810'],
    },
  },
  orange: {
    primary: '#F97316',
    primaryDark: '#EA580C',
    secondary: '#FBBF24',
    success: '#34D399',
    danger: '#FB7185',
    warning: '#FBBF24',
    muted: '#291408',
    mutedStrong: '#3D1E0A',
    gradient: {
      brand: ['#F97316', '#EA580C'],
      brandVibrant: ['#FB923C', '#F97316', '#FBBF24'],
      success: ['#34D399', '#10B981'],
      danger: ['#FB7185', '#F43F5E'],
      sky: ['#FBBF24', '#F97316'],
      sunset: ['#F97316', '#FBBF24'],
      surface: ['#180C04', '#0F0802'],
    },
  },
  rose: {
    primary: '#F43F5E',
    primaryDark: '#E11D48',
    secondary: '#EC4899',
    success: '#34D399',
    danger: '#FB7185',
    warning: '#FBBF24',
    muted: '#2A0A12',
    mutedStrong: '#3D0F1C',
    gradient: {
      brand: ['#F43F5E', '#E11D48'],
      brandVibrant: ['#FB7185', '#F43F5E', '#EC4899'],
      success: ['#34D399', '#10B981'],
      danger: ['#FB7185', '#F43F5E'],
      sky: ['#EC4899', '#F43F5E'],
      sunset: ['#F43F5E', '#EC4899'],
      surface: ['#180409', '#0F0205'],
    },
  },
};

const accentPalettesLight: Record<AccentPalette, AccentColors> = {
  purple: {
    primary: '#6355E8',
    primaryDark: '#5245D4',
    secondary: '#0891B2',
    success: '#059669',
    danger: '#E11D48',
    warning: '#D97706',
    muted: '#EEECFB',
    mutedStrong: '#E0DCF7',
    gradient: {
      brand: ['#7C6FFF', '#5B4FE8'],
      brandVibrant: ['#8B7CFF', '#6366F1', '#5145D8'],
      success: ['#34D399', '#059669'],
      danger: ['#FB7185', '#E11D48'],
      sky: ['#38BDF8', '#6366F1'],
      sunset: ['#FB7185', '#FBBF24'],
      surface: ['#FFFFFF', '#F6F6FB'],
    },
  },
  emerald: {
    primary: '#059669',
    primaryDark: '#047857',
    secondary: '#0891B2',
    success: '#059669',
    danger: '#E11D48',
    warning: '#D97706',
    muted: '#ECFDF5',
    mutedStrong: '#D1FAE5',
    gradient: {
      brand: ['#10B981', '#059669'],
      brandVibrant: ['#34D399', '#10B981', '#047857'],
      success: ['#34D399', '#059669'],
      danger: ['#FB7185', '#E11D48'],
      sky: ['#38BDF8', '#059669'],
      sunset: ['#10B981', '#38BDF8'],
      surface: ['#FFFFFF', '#F0FDF4'],
    },
  },
  blue: {
    primary: '#2563EB',
    primaryDark: '#1D4ED8',
    secondary: '#0891B2',
    success: '#059669',
    danger: '#E11D48',
    warning: '#D97706',
    muted: '#EFF6FF',
    mutedStrong: '#DBEAFE',
    gradient: {
      brand: ['#3B82F6', '#2563EB'],
      brandVibrant: ['#60A5FA', '#3B82F6', '#06B6D4'],
      success: ['#34D399', '#059669'],
      danger: ['#FB7185', '#E11D48'],
      sky: ['#06B6D4', '#2563EB'],
      sunset: ['#2563EB', '#06B6D4'],
      surface: ['#FFFFFF', '#EFF6FF'],
    },
  },
  orange: {
    primary: '#EA580C',
    primaryDark: '#C2410C',
    secondary: '#D97706',
    success: '#059669',
    danger: '#E11D48',
    warning: '#D97706',
    muted: '#FFF7ED',
    mutedStrong: '#FFEDD5',
    gradient: {
      brand: ['#F97316', '#EA580C'],
      brandVibrant: ['#FB923C', '#F97316', '#FBBF24'],
      success: ['#34D399', '#059669'],
      danger: ['#FB7185', '#E11D48'],
      sky: ['#FBBF24', '#EA580C'],
      sunset: ['#F97316', '#FBBF24'],
      surface: ['#FFFFFF', '#FFF7ED'],
    },
  },
  rose: {
    primary: '#E11D48',
    primaryDark: '#BE123C',
    secondary: '#DB2777',
    success: '#059669',
    danger: '#E11D48',
    warning: '#D97706',
    muted: '#FFF1F2',
    mutedStrong: '#FFE4E6',
    gradient: {
      brand: ['#F43F5E', '#E11D48'],
      brandVibrant: ['#FB7185', '#F43F5E', '#EC4899'],
      success: ['#34D399', '#059669'],
      danger: ['#FB7185', '#E11D48'],
      sky: ['#EC4899', '#E11D48'],
      sunset: ['#F43F5E', '#EC4899'],
      surface: ['#FFFFFF', '#FFF1F2'],
    },
  },
};

// ─── Base Colors (backgrounds / borders / text) ────────────────────────────────

const baseColors = {
  dark: {
    background: {
      primary: '#0B0B10',
      secondary: '#16161F',
      tertiary: '#1F1F2C',
      elevated: '#22222F',
    },
    border: {
      subtle: '#26263400',
      hairline: '#2A2A3A',
    },
    text: {
      primary: '#F4F4FA',
      secondary: '#9A9AB0',
      tertiary: '#6B6B80',
      onAccent: '#FFFFFF',
    },
    overlay: 'rgba(0,0,0,0.6)',
    shimmer: ['#1A1A24', '#24242F', '#1A1A24'] as [string, string, string],
  },
  light: {
    background: {
      primary: '#F6F6FB',
      secondary: '#FFFFFF',
      tertiary: '#EFEFF6',
      elevated: '#FFFFFF',
    },
    border: {
      subtle: '#00000000',
      hairline: '#E6E6F0',
    },
    text: {
      primary: '#15151F',
      secondary: '#6B6B80',
      tertiary: '#9A9AB0',
      onAccent: '#FFFFFF',
    },
    overlay: 'rgba(15,15,25,0.35)',
    shimmer: ['#ECECF3', '#F5F5FA', '#ECECF3'] as [string, string, string],
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 44,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  '2xl': 28,
  full: 9999,
} as const;

export const typography = {
  fontFamily: {
    display: 'Inter_700Bold',
    displayExtra: 'Inter_800ExtraBold',
    semibold: 'Inter_700Bold',
    medium: 'Inter_500Medium',
    body: 'Inter_400Regular',
    mono: 'JetBrainsMono_400Regular',
  },
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 44,
  },
  lineHeight: {
    xs: 15.4,
    sm: 19.5,
    base: 24,
    lg: 25.5,
    xl: 28,
    '2xl': 31.2,
    '3xl': 38.4,
    '4xl': 48.4,
  },
} as const;

export type ColorScheme = 'dark' | 'light';

function makeShadows(scheme: ColorScheme, palette: AccentPalette) {
  const color = scheme === 'dark' ? '#000000' : '#1B1B3A';
  const opacity = scheme === 'dark' ? 0.45 : 0.12;
  const glowColor = accentPalettesDark[palette].primary;
  return {
    none: {},
    sm: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: opacity * 0.6,
      shadowRadius: 6,
      elevation: 2,
    },
    md: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: opacity * 0.8,
      shadowRadius: 14,
      elevation: 5,
    },
    lg: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: opacity,
      shadowRadius: 24,
      elevation: 10,
    },
    fab: {
      shadowColor: glowColor,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 18,
      elevation: 10,
    },
    glow: {
      shadowColor: glowColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.55,
      shadowRadius: 22,
      elevation: 8,
    },
  } as const;
}

export function getTheme(scheme: ColorScheme = 'dark', palette: AccentPalette = 'purple') {
  const base = baseColors[scheme];
  const accent = scheme === 'dark' ? accentPalettesDark[palette] : accentPalettesLight[palette];
  return {
    colors: {
      ...base,
      accent,
      gradient: accent.gradient,
    },
    spacing,
    radius,
    typography,
    shadows: makeShadows(scheme, palette),
    scheme,
    palette,
  };
}

export type Theme = ReturnType<typeof getTheme>;

// ─── Palette metadata for the Settings UI ────────────────────────────────────

export const ACCENT_PALETTES: { id: AccentPalette; label: string; color: string; emoji: string }[] = [
  { id: 'purple', label: 'Purple',  color: '#8B7CFF', emoji: '🟣' },
  { id: 'emerald', label: 'Emerald', color: '#10B981', emoji: '🟢' },
  { id: 'blue',   label: 'Blue',    color: '#3B82F6', emoji: '🔵' },
  { id: 'orange', label: 'Orange',  color: '#F97316', emoji: '🟠' },
  { id: 'rose',   label: 'Rose',    color: '#F43F5E', emoji: '🔴' },
];
