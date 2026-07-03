import { useEffect, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { ParsedExpense } from '@split/shared';
import { EXPENSE_CATEGORIES, getLowConfidenceFields, SUPPORTED_CURRENCIES } from '@split/shared';
import { useTheme } from '../theme/ThemeProvider';
import { AppButton, Chip, noOutline } from './ui';

interface AIConfirmationSheetProps {
  visible: boolean;
  parsed: ParsedExpense | null;
  onParsedChange?: (parsed: ParsedExpense) => void;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  onEdit?: () => void;
  saveError?: string;
  saving?: boolean;
}

export function AIConfirmationSheet({
  visible,
  parsed,
  onParsedChange,
  onSave,
  onCancel,
  onEdit,
  saveError,
  saving = false,
}: AIConfirmationSheetProps) {
  const theme = useTheme();
  const [draft, setDraft] = useState<ParsedExpense | null>(parsed);

  useEffect(() => {
    if (visible && parsed) setDraft(parsed);
  }, [visible, parsed]);

  if (!draft) return null;

  const lowConfidence = getLowConfidenceFields(draft.confidence);

  const update = (patch: Partial<ParsedExpense>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onParsedChange?.(next);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <BlurView intensity={40} style={styles.backdrop} tint="dark">
        <Pressable style={styles.backdropPress} onPress={onCancel} />
        <View style={[styles.sheet, { backgroundColor: theme.colors.background.elevated }]}>
          <View style={[styles.handle, { backgroundColor: theme.colors.border.hairline }]} />

          <Text style={[styles.header, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]}>✨ Confirm expense</Text>
          <Text style={[styles.subheader, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>
            Tap any field to edit before saving
          </Text>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={[styles.card, { backgroundColor: theme.colors.background.secondary }]}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text.secondary }]}>Description</Text>
              <TextInput
                style={[styles.input, noOutline, { color: theme.colors.text.primary, borderColor: theme.colors.border.hairline }]}
                value={draft.description}
                onChangeText={(description) => update({ description })}
              />

              <EditableRow label="Paid by" lowConfidence={lowConfidence.includes('payer')} theme={theme}>
                <TextInput
                  style={[styles.input, noOutline, styles.inputInline, { color: theme.colors.text.primary, borderColor: theme.colors.border.hairline }]}
                  value={draft.payer ?? 'You'}
                  onChangeText={(payer) => update({ payer: payer || null })}
                  placeholder="You"
                  placeholderTextColor={theme.colors.text.secondary}
                />
              </EditableRow>

              <EditableRow label="Amount" lowConfidence={lowConfidence.includes('amount')} theme={theme}>
                <TextInput
                  style={[styles.input, noOutline, styles.inputInline, { color: theme.colors.text.primary, borderColor: theme.colors.border.hairline }]}
                  value={draft.amount != null ? String(draft.amount) : ''}
                  onChangeText={(v) => update({ amount: parseFloat(v) || null })}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={theme.colors.text.secondary}
                />
              </EditableRow>

              <Text style={[styles.fieldLabel, { color: theme.colors.text.secondary, marginTop: 8 }]}>Currency</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 8 }}>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <Chip key={c} label={c} selected={draft.currency === c} onPress={() => update({ currency: c })} />
                ))}
              </ScrollView>

              <Text style={[styles.fieldLabel, { color: theme.colors.text.secondary }]}>Split type</Text>
              <View style={styles.chips}>
                {(['equal', 'exact', 'percentage', 'shares'] as const).map((t) => (
                  <Chip key={t} label={t} selected={draft.split_type === t} onPress={() => update({ split_type: t })} />
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: theme.colors.text.secondary }]}>Group hint</Text>
              <TextInput
                style={[styles.input, noOutline, { color: theme.colors.text.primary, borderColor: theme.colors.border.hairline }]}
                value={draft.group_hint ?? ''}
                onChangeText={(group_hint) => update({ group_hint: group_hint || null })}
                placeholder="Optional group name"
                placeholderTextColor={theme.colors.text.secondary}
              />

              <Text style={[styles.fieldLabel, { color: theme.colors.text.secondary }]}>Date</Text>
              <TextInput
                style={[styles.input, noOutline, { color: theme.colors.text.primary, borderColor: theme.colors.border.hairline }]}
                value={draft.date ?? ''}
                onChangeText={(date) => update({ date: date || null })}
                placeholder="today, yesterday, or ISO date"
                placeholderTextColor={theme.colors.text.secondary}
              />

              <Text style={[styles.fieldLabel, { color: theme.colors.text.secondary }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 8 }}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <Chip key={c} label={c} selected={draft.category === c} onPress={() => update({ category: c })} />
                ))}
              </ScrollView>
            </View>

            <Text style={[styles.sectionLabel, { color: theme.colors.text.secondary }]}>Participants (comma-separated)</Text>
            <TextInput
              style={[styles.input, noOutline, { color: theme.colors.text.primary, borderColor: theme.colors.border.hairline, marginBottom: 12 }]}
              value={draft.participants.join(', ')}
              onChangeText={(text) =>
                update({
                  participants: text
                    .split(',')
                    .map((p) => p.trim())
                    .filter(Boolean),
                })
              }
              placeholder="You, Alex, Priya"
              placeholderTextColor={theme.colors.text.secondary}
            />

            {draft.ambiguities.map((a, i) => (
              <View key={i} style={[styles.warning, { borderLeftColor: theme.colors.accent.warning }]}>
                <Ionicons name="warning" size={16} color={theme.colors.accent.warning} />
                <Text style={[styles.warningText, { color: theme.colors.accent.warning }]}>{a}</Text>
              </View>
            ))}

            {saveError ? (
              <View style={[styles.errorBox, { backgroundColor: theme.colors.background.secondary }]}>
                <Ionicons name="alert-circle" size={18} color={theme.colors.accent.danger} />
                <Text style={{ color: theme.colors.accent.danger, fontSize: 13, flex: 1, marginLeft: 8 }}>{saveError}</Text>
              </View>
            ) : null}
          </ScrollView>

          <AppButton
            label="Save Expense"
            icon="checkmark-circle"
            size="lg"
            loading={saving}
            onPress={() => void onSave()}
            fullWidth
            style={{ marginHorizontal: 20, marginTop: 16 }}
          />

          <View style={styles.ghostActions}>
            {onEdit ? (
              <>
                <Pressable onPress={onEdit} disabled={saving}>
                  <Text style={{ color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }}>Full editor</Text>
                </Pressable>
                <Text style={{ color: theme.colors.text.tertiary }}> · </Text>
              </>
            ) : null}
            <Pressable onPress={onCancel} disabled={saving}>
              <Text style={{ color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

function EditableRow({
  label,
  children,
  theme,
  lowConfidence,
}: {
  label: string;
  children: ReactNode;
  theme: ReturnType<typeof useTheme>;
  lowConfidence?: boolean;
}) {
  return (
    <View style={[styles.fieldRow, lowConfidence && { borderLeftWidth: 3, borderLeftColor: theme.colors.accent.warning, paddingLeft: 8 }]}>
      <Text style={[styles.fieldLabel, { color: theme.colors.text.secondary, marginBottom: 0 }]}>{label}</Text>
      <View style={{ flex: 1, marginLeft: 12 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  backdropPress: { flex: 1 },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: 32, maxHeight: '90%' },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  header: { fontSize: 20, paddingHorizontal: 20 },
  subheader: { fontSize: 13, paddingHorizontal: 20, marginBottom: 12 },
  content: { paddingHorizontal: 20, maxHeight: 480 },
  card: { borderRadius: 16, padding: 16, marginBottom: 16 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  fieldLabel: { fontSize: 13, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 4 },
  inputInline: { marginBottom: 0, textAlign: 'right' },
  sectionLabel: { fontSize: 13, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 6 },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderLeftWidth: 3, paddingLeft: 12, marginBottom: 8 },
  warningText: { fontSize: 13, flex: 1 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: 12, marginBottom: 8 },
  saveButton: { marginHorizontal: 20, marginTop: 16, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  saveText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  ghostActions: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
});
