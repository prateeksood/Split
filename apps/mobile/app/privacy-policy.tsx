import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { ScreenHeader, Card } from '../components/ui';

const SECTIONS = [
  {
    title: 'Information We Collect',
    body: 'Account information (name, email), expense data you create, natural language input for AI parsing, and device tokens for push notifications if enabled.',
  },
  {
    title: 'How We Use Your Data',
    body: 'To provide expense splitting, balance calculations, AI-powered expense parsing, and activity notifications.',
  },
  {
    title: 'AI Processing',
    body: 'Natural language input is processed server-side. Input is sanitized (PII patterns stripped, 500 character limit) before sending to AI providers. API keys are never exposed to the client.',
  },
  {
    title: 'Data Storage',
    body: 'Data is stored in PostgreSQL. Authentication tokens use device secure storage (Keychain/Keystore), not plain AsyncStorage.',
  },
  {
    title: 'Third-Party Services',
    body: 'Google OAuth (optional sign-in), Google Gemini / Groq / OpenRouter (AI parsing), Expo push notifications, and optional S3/R2 (receipt storage).',
  },
  {
    title: 'Contact',
    body: 'Questions about this policy: privacy@split.app',
  },
];

export default function PrivacyPolicyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top }]}>
      <ScreenHeader title="Privacy Policy" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.updated, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.body }]}>Last updated: June 28, 2026</Text>
        {SECTIONS.map((section) => (
          <Card key={section.title} style={{ marginBottom: 12 }}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]}>{section.title}</Text>
            <Text style={[styles.body, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>{section.body}</Text>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  updated: { fontSize: 13, marginBottom: 16 },
  sectionTitle: { fontSize: 16, marginBottom: 8 },
  body: { fontSize: 14.5, lineHeight: 22 },
});
