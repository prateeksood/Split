import { Tabs, useRouter } from 'expo-router';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeProvider';

export default function TabLayout() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.background.secondary,
          borderTopColor: theme.colors.border.hairline,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
          ...theme.shadows.lg,
        },
        tabBarActiveTintColor: theme.colors.accent.primary,
        tabBarInactiveTintColor: theme.colors.text.tertiary,
        tabBarLabelStyle: { fontSize: 11, fontFamily: theme.typography.fontFamily.medium },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} theme={theme} />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="people" color={color} focused={focused} theme={theme} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarButton: () => <FAB theme={theme} onPress={() => router.push('/select-group')} />,
        }}
        listeners={{ tabPress: (e) => e.preventDefault() }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person" color={color} focused={focused} theme={theme} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="time" color={color} focused={focused} theme={theme} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  name,
  color,
  focused,
  theme,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.tabIcon}>
      <Ionicons name={focused ? name : (`${name}-outline` as keyof typeof Ionicons.glyphMap)} size={23} color={color} />
      {focused && (
        <View style={[styles.dot, { backgroundColor: theme.colors.accent.primary }]} />
      )}
    </View>
  );
}

function FAB({ theme, onPress }: { theme: ReturnType<typeof useTheme>; onPress: () => void }) {
  return (
    <Pressable style={styles.fabWrapper} onPress={onPress}>
      <LinearGradient
        colors={theme.colors.gradient.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.fab, theme.shadows.fab]}
      >
        <Ionicons name="add" size={30} color="#FFF" />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabIcon: { alignItems: 'center', justifyContent: 'center', height: 28 },
  dot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 4 },
  fabWrapper: {
    top: -22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
