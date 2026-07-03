import { ScrollView, Text, StyleSheet } from 'react-native';
import { SUPPORTED_CURRENCIES } from '@split/shared';
import { useTheme } from '../theme/ThemeProvider';
import { Chip } from './ui';

interface CurrencyPickerProps {
  value: string;
  onChange: (currency: string) => void;
  label?: string;
}

export function CurrencyPicker({ value, onChange, label = 'Currency' }: CurrencyPickerProps) {
  const theme = useTheme();

  return (
    <>
      {label ? (
        <Text style={[styles.label, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>{label}</Text>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 16 }}>
        {SUPPORTED_CURRENCIES.map((c) => (
          <Chip key={c} label={c} selected={value === c} onPress={() => onChange(c)} />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, marginBottom: 10, marginTop: 8 },
});
