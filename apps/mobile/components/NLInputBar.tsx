import { useState, useEffect } from 'react';

import {

  View,

  TextInput,

  Pressable,

  StyleSheet,

  ActivityIndicator,

  Text,

} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { LinearGradient } from 'expo-linear-gradient';

import { impactLight } from '../services/haptics';

import { useTheme } from '../theme/ThemeProvider';

import { noOutline } from './ui';

import { isVoiceInputAvailable, listenForSpeech } from '../services/voiceInput';

import { showVoiceUnavailableAlert } from '../hooks/useNLExpense';



const PLACEHOLDERS = [

  'Paid ₹500 for pizza with Rahul...',

  'I spent $80 on groceries yesterday...',

  'Split ₹1200 dinner equally with 3 friends...',

  'Uber ride $25, I paid, split with Priya',

];



interface NLInputBarProps {
  onSubmit: (text: string) => void;
  isLoading?: boolean;
  groupName?: string;
}

export function NLInputBar({ onSubmit, isLoading, groupName }: NLInputBarProps) {

  const theme = useTheme();

  const [text, setText] = useState('');

  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const [listening, setListening] = useState(false);

  const [voiceAvailable, setVoiceAvailable] = useState(false);



  useEffect(() => {

    isVoiceInputAvailable().then(setVoiceAvailable);

    const interval = setInterval(() => {

      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);

    }, 4000);

    return () => clearInterval(interval);

  }, []);



  const handleSubmit = () => {

    if (!text.trim() || isLoading) return;

    impactLight();

    onSubmit(text.trim());

  };



  const handleVoice = async () => {

    if (isLoading || listening) return;

    if (!voiceAvailable) {

      showVoiceUnavailableAlert();

      return;

    }



    impactLight();

    setListening(true);

    try {

      const { transcript } = await listenForSpeech((partial) => setText(partial));

      if (transcript.trim()) {

        setText(transcript.trim());

        onSubmit(transcript.trim());

      }

    } catch {

      showVoiceUnavailableAlert();

    } finally {

      setListening(false);

    }

  };



  return (
    <View style={styles.wrapper}>
      {groupName ? (
        <View style={styles.groupLabelRow}>
          <Ionicons name="sparkles" size={13} color={theme.colors.accent.primary} />
          <Text style={[styles.groupLabel, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>
            AI expense for {groupName}
          </Text>
        </View>
      ) : null}
      <View
        style={[
          styles.container,
          theme.shadows.sm,
          {
            backgroundColor: theme.colors.background.secondary,
            borderColor: theme.colors.border.hairline,
          },
        ]}
      >
        <LinearGradient colors={theme.colors.gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sparkBadge}>
          <Ionicons name="sparkles" size={15} color="#FFFFFF" />
        </LinearGradient>

        <TextInput
          style={[styles.input, noOutline, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.body }]}
          placeholder={PLACEHOLDERS[placeholderIndex]}
          placeholderTextColor={theme.colors.text.tertiary}
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
          editable={!isLoading && !listening}
        />

        <Pressable onPress={handleVoice} disabled={isLoading || listening} style={styles.micButton}>
          {listening ? (
            <ActivityIndicator size="small" color={theme.colors.accent.primary} />
          ) : (
            <Ionicons
              name="mic-outline"
              size={22}
              color={voiceAvailable ? theme.colors.accent.primary : theme.colors.text.tertiary}
            />
          )}
        </Pressable>

        <Pressable
          onPress={handleSubmit}
          disabled={isLoading || !text.trim() || listening}
          style={[styles.sendButton, { opacity: text.trim() && !isLoading ? 1 : 0.5 }]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <LinearGradient colors={theme.colors.gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendInner}>
              <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
            </LinearGradient>
          )}
        </Pressable>
      </View>

      {isLoading && (
        <View style={[styles.loadingOverlay, { backgroundColor: theme.colors.background.secondary + 'F2', borderColor: theme.colors.border.hairline }]}>
          <Ionicons name="sparkles" size={16} color={theme.colors.accent.primary} />
          <Text style={[styles.thinking, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>Thinking…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', marginBottom: 8 },
  groupLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginHorizontal: 20, marginBottom: 8 },
  groupLabel: { fontSize: 12 },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 10,
    paddingRight: 8,
    marginHorizontal: 20,
  },
  sparkBadge: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontSize: 15, paddingHorizontal: 10, paddingVertical: 8 },
  micButton: { padding: 8 },
  sendButton: { paddingLeft: 2 },
  sendInner: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: undefined,
    height: 56,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  thinking: { fontSize: 14 },
});


