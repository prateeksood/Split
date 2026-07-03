import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Share, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { formatCurrency } from '@split/shared';
import { useTheme } from '../theme/ThemeProvider';
import { api, type InsightItem } from '../services/api';
import { DonutChart, BarChart, LineChart, HorizontalBarChart } from '../components/Charts';
import { Skeleton } from '../components/Skeleton';
import { ScreenHeader, SectionHeader, Chip, Card } from '../components/ui';

type DateRange = '7d' | '30d' | '90d' | '6m' | '1y' | 'all';
type TabId = 'overview' | 'categories' | 'trend' | 'groups';

const RANGES: { id: DateRange; label: string }[] = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: '6m', label: '6M' },
  { id: '1y', label: '1Y' },
  { id: 'all', label: 'All' },
];

const TABS: { id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'overview', label: 'Overview', icon: 'grid-outline' },
  { id: 'categories', label: 'Categories', icon: 'pie-chart-outline' },
  { id: 'trend', label: 'Trend', icon: 'trending-up-outline' },
  { id: 'groups', label: 'Groups', icon: 'people-outline' },
];

const INSIGHT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  trend: 'trending-up',
  category: 'pricetag',
  group: 'people',
  average: 'calculator',
  owed: 'swap-horizontal',
};

export default function ReportsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = theme.colors;

  const [tab, setTab] = useState<TabId>('overview');
  const [range, setRange] = useState<DateRange>('30d');

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.users.me() });
  const currency = profile?.defaultCurrency ?? 'USD';

  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['reports', 'insights', range],
    queryFn: () => api.reports.insights(range),
  });

  const { data: categories, isLoading: catLoading } = useQuery({
    queryKey: ['reports', 'categories', range],
    queryFn: () => api.reports.categories(undefined, range),
    enabled: tab === 'categories' || tab === 'overview',
  });

  const { data: monthly, isLoading: monthLoading } = useQuery({
    queryKey: ['reports', 'monthly', range],
    queryFn: () => api.reports.monthly(undefined, range),
    enabled: tab === 'trend' || tab === 'overview',
  });

  const { data: weekly } = useQuery({
    queryKey: ['reports', 'weekly', range],
    queryFn: () => api.reports.weekly(undefined, range),
    enabled: (tab === 'trend') && (range === '7d' || range === '30d'),
  });

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['reports', 'groups', range],
    queryFn: () => api.reports.groups(range),
    enabled: tab === 'groups',
  });

  const handleExportCsv = async () => {
    const { csv } = await api.reports.exportCsv();
    await Share.share({ message: csv, title: 'Split Expenses Export' });
  };

  const handleExportPdf = async () => {
    const { pdf, filename } = await api.reports.exportPdf();
    if (Platform.OS === 'web') {
      const blob = Uint8Array.from(atob(pdf), (ch) => ch.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const path = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(path, pdf, { encoding: FileSystem.EncodingType.Base64 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: 'application/pdf', dialogTitle: 'Export PDF' });
    }
  };

  const useLineChart = tab === 'trend' && (range === '7d' || range === '30d');
  const trendData = useLineChart ? (weekly ?? []) : (monthly ?? []);

  return (
    <View style={[styles.container, { backgroundColor: c.background.primary, paddingTop: insets.top }]}>
      <ScreenHeader title="Analytics" onBack={() => router.back()} />

      {/* Range filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangeRow}>
        {RANGES.map((r) => (
          <Chip key={r.id} label={r.label} selected={range === r.id} onPress={() => setRange(r.id)} />
        ))}
      </ScrollView>

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: c.border.hairline, backgroundColor: c.background.secondary }]}>
        {TABS.map((t) => (
          <Pressable key={t.id} style={[styles.tab, tab === t.id && { borderBottomColor: c.accent.primary, borderBottomWidth: 2 }]} onPress={() => setTab(t.id)}>
            <Ionicons name={t.icon} size={16} color={tab === t.id ? c.accent.primary : c.text.tertiary} />
            <Text style={[styles.tabLabel, { color: tab === t.id ? c.accent.primary : c.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <>
            {/* KPI cards */}
            {insightsLoading ? (
              <View style={styles.kpiRow}>
                <Skeleton height={80} style={{ flex: 1, borderRadius: 16 }} />
                <Skeleton height={80} style={{ flex: 1, borderRadius: 16 }} />
              </View>
            ) : insights ? (
              <View style={styles.kpiRow}>
                <Card style={[styles.kpiCard, { borderColor: c.border.hairline }]}>
                  <Text style={[styles.kpiLabel, { color: c.text.tertiary, fontFamily: theme.typography.fontFamily.body }]}>Total spend</Text>
                  <Text style={[styles.kpiValue, { color: c.accent.primary, fontFamily: theme.typography.fontFamily.displayExtra }]}>
                    {formatCurrency(insights.totalSpend, currency)}
                  </Text>
                </Card>
                <Card style={[styles.kpiCard, { borderColor: c.border.hairline }]}>
                  <Text style={[styles.kpiLabel, { color: c.text.tertiary, fontFamily: theme.typography.fontFamily.body }]}>Expenses</Text>
                  <Text style={[styles.kpiValue, { color: c.text.primary, fontFamily: theme.typography.fontFamily.displayExtra }]}>
                    {insights.expenseCount}
                  </Text>
                </Card>
              </View>
            ) : null}

            {/* Smart insights */}
            {insightsLoading ? (
              <Skeleton height={100} borderRadius={16} style={{ marginBottom: 16 }} />
            ) : insights?.insights.length ? (
              <>
                <SectionHeader title="Smart Insights" />
                <View style={styles.insightsList}>
                  {insights.insights.map((item: InsightItem, i: number) => (
                    <InsightCard key={i} item={item} theme={theme} />
                  ))}
                </View>
              </>
            ) : null}

            {/* Mini category donut */}
            {catLoading ? (
              <Skeleton height={200} borderRadius={16} style={{ marginTop: 8 }} />
            ) : categories?.length ? (
              <>
                <SectionHeader title="Top Categories" />
                <Card style={{ padding: 16 }}>
                  <DonutChart data={categories.slice(0, 5)} size={180} currency={currency} />
                </Card>
              </>
            ) : null}

            {/* Mini monthly */}
            {monthLoading ? (
              <Skeleton height={180} borderRadius={16} style={{ marginTop: 16 }} />
            ) : monthly?.length ? (
              <>
                <SectionHeader title="Monthly Trend" />
                <Card style={{ padding: 16 }}>
                  <BarChart data={monthly.slice(-6)} height={150} showPaid />
                </Card>
              </>
            ) : null}
          </>
        )}

        {/* ── Categories ── */}
        {tab === 'categories' && (
          <>
            {catLoading ? (
              <Skeleton height={320} borderRadius={16} />
            ) : categories?.length ? (
              <>
                <SectionHeader title="Spending breakdown" />
                <Card style={{ padding: 16 }}>
                  <DonutChart data={categories} size={220} currency={currency} />
                </Card>
                <SectionHeader title="All categories" />
                {categories.map((cat, i) => {
                  const total = categories.reduce((s, c) => s + c.amount, 0);
                  const pct = Math.round((cat.amount / (total || 1)) * 100);
                  return (
                    <View key={i} style={[styles.catRow, { borderColor: c.border.hairline, backgroundColor: c.background.secondary }]}>
                      <Text style={[styles.catName, { color: c.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
                        {cat.category}
                      </Text>
                      <View style={styles.catRight}>
                        <Text style={[styles.catPct, { color: c.text.tertiary, fontFamily: theme.typography.fontFamily.body }]}>{pct}%</Text>
                        <Text style={[styles.catAmount, { color: c.accent.primary, fontFamily: theme.typography.fontFamily.display }]}>
                          {formatCurrency(cat.amount, currency)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : <EmptyState theme={theme} />}
          </>
        )}

        {/* ── Trend ── */}
        {tab === 'trend' && (
          <>
            {monthLoading ? (
              <Skeleton height={220} borderRadius={16} />
            ) : trendData.length ? (
              <>
                <SectionHeader title={useLineChart ? 'Weekly spending' : 'Monthly spending'} />
                <Card style={{ padding: 16 }}>
                  {useLineChart
                    ? <LineChart data={trendData as { week: string; amount: number }[]} height={200} />
                    : <BarChart data={trendData} height={200} showPaid />
                  }
                </Card>

                {!useLineChart && (
                  <>
                    <SectionHeader title="Month by month" />
                    {(trendData as { month: string; amount: number }[]).slice().reverse().map((m, i) => (
                      <View key={i} style={[styles.catRow, { borderColor: c.border.hairline, backgroundColor: c.background.secondary }]}>
                        <Text style={[styles.catName, { color: c.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
                          {m.month}
                        </Text>
                        <Text style={[styles.catAmount, { color: c.accent.primary, fontFamily: theme.typography.fontFamily.display }]}>
                          {formatCurrency(m.amount, currency)}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </>
            ) : <EmptyState theme={theme} />}
          </>
        )}

        {/* ── Groups ── */}
        {tab === 'groups' && (
          <>
            {groupsLoading ? (
              <Skeleton height={200} borderRadius={16} />
            ) : groups?.length ? (
              <>
                <SectionHeader title="Spending by group" />
                <Card style={{ padding: 16 }}>
                  <HorizontalBarChart data={groups} />
                </Card>
                <SectionHeader title="Group details" />
                {groups.map((g, i) => (
                  <View key={i} style={[styles.catRow, { borderColor: c.border.hairline, backgroundColor: c.background.secondary }]}>
                    <View>
                      <Text style={[styles.catName, { color: c.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>{g.name}</Text>
                      <Text style={[styles.catPct, { color: c.text.tertiary, fontFamily: theme.typography.fontFamily.body }]}>{g.count} expense{g.count !== 1 ? 's' : ''}</Text>
                    </View>
                    <Text style={[styles.catAmount, { color: c.accent.primary, fontFamily: theme.typography.fontFamily.display }]}>
                      {formatCurrency(g.amount, currency)}
                    </Text>
                  </View>
                ))}
              </>
            ) : <EmptyState theme={theme} />}
          </>
        )}

        {/* Export actions */}
        <SectionHeader title="Export" />
        <View style={styles.exportRow}>
          <Pressable style={[styles.exportBtn, { backgroundColor: c.background.secondary, borderColor: c.border.hairline }]} onPress={handleExportCsv}>
            <Ionicons name="document-text-outline" size={18} color={c.accent.primary} />
            <Text style={[styles.exportLabel, { color: c.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>CSV</Text>
          </Pressable>
          <Pressable style={[styles.exportBtn, { backgroundColor: c.background.secondary, borderColor: c.border.hairline }]} onPress={handleExportPdf}>
            <Ionicons name="document-outline" size={18} color={c.accent.danger} />
            <Text style={[styles.exportLabel, { color: c.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>PDF</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function InsightCard({ item, theme }: { item: InsightItem; theme: ReturnType<typeof useTheme> }) {
  const c = theme.colors;
  const icon = INSIGHT_ICONS[item.type] ?? 'information-circle';
  const accent = item.positive === true ? c.accent.success : item.positive === false ? c.accent.danger : c.accent.primary;
  return (
    <View style={[styles.insightCard, { backgroundColor: c.background.secondary, borderColor: c.border.hairline }]}>
      <View style={[styles.insightIcon, { backgroundColor: accent + '22' }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.insightTitle, { color: c.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>{item.title}</Text>
        <Text style={[styles.insightBody, { color: c.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>{item.body}</Text>
      </View>
    </View>
  );
}

function EmptyState({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="bar-chart-outline" size={40} color={theme.colors.text.tertiary} />
      <Text style={{ color: theme.colors.text.secondary, marginTop: 12, fontFamily: theme.typography.fontFamily.body }}>
        No data for this period
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  rangeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 4 },
  tabLabel: { fontSize: 11 },
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  kpiCard: { flex: 1, borderRadius: 16, padding: 16, borderWidth: 1 },
  kpiLabel: { fontSize: 12, marginBottom: 4 },
  kpiValue: { fontSize: 20 },
  insightsList: { gap: 10, marginBottom: 8 },
  insightCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  insightIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  insightTitle: { fontSize: 14, marginBottom: 3 },
  insightBody: { fontSize: 12.5, lineHeight: 17 },
  catRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  catName: { fontSize: 14 },
  catRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catPct: { fontSize: 12 },
  catAmount: { fontSize: 15 },
  exportRow: { flexDirection: 'row', gap: 12 },
  exportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  exportLabel: { fontSize: 14 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
});
