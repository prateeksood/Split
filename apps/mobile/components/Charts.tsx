import { View, Text } from 'react-native';
import Svg, { G, Path, Circle, Line, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

// ─── Palette ─────────────────────────────────────────────────────────────────
// Derives chart colors from the current theme's accent + a rich supporting palette.
function useChartColors(): string[] {
  const theme = useTheme();
  return [
    theme.colors.accent.primary,
    theme.colors.accent.secondary,
    theme.colors.accent.success,
    theme.colors.accent.danger,
    theme.colors.accent.warning,
    '#A78BFA',
    '#38BDF8',
    '#FB923C',
    '#4ADE80',
    '#F472B6',
  ];
}

// ─── DonutChart ───────────────────────────────────────────────────────────────

export interface DonutSlice { category: string; amount: number }

export function DonutChart({ data, size = 220, currency = '' }: { data: DonutSlice[]; size?: number; currency?: string }) {
  const theme = useTheme();
  const colors = useChartColors();
  const total = data.reduce((s, d) => s + d.amount, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 12;
  const innerR = outerR * 0.58;
  let angle = -Math.PI / 2;

  const slices = data.map((item, i) => {
    const sweep = (item.amount / total) * Math.PI * 2;
    const end = angle + sweep;
    const x1 = cx + outerR * Math.cos(angle);
    const y1 = cy + outerR * Math.sin(angle);
    const x2 = cx + outerR * Math.cos(end);
    const y2 = cy + outerR * Math.sin(end);
    const xi1 = cx + innerR * Math.cos(end);
    const yi1 = cy + innerR * Math.sin(end);
    const xi2 = cx + innerR * Math.cos(angle);
    const yi2 = cy + innerR * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${innerR} ${innerR} 0 ${large} 0 ${xi2} ${yi2} Z`;
    angle = end;
    return { d, color: colors[i % colors.length], category: item.category, amount: item.amount, pct: Math.round((item.amount / total) * 100) };
  });

  return (
    <View>
      <View style={{ alignItems: 'center' }}>
        <Svg width={size} height={size}>
          <G>
            {slices.map((s, i) => (
              <Path key={i} d={s.d} fill={s.color} />
            ))}
            <Circle cx={cx} cy={cy} r={innerR - 2} fill={theme.colors.background.secondary} />
            <SvgText x={cx} y={cy - 8} textAnchor="middle" fill={theme.colors.text.primary} fontSize={14} fontWeight="700">
              {currency}
            </SvgText>
            <SvgText x={cx} y={cy + 10} textAnchor="middle" fill={theme.colors.text.secondary} fontSize={12}>
              total
            </SvgText>
          </G>
        </Svg>
      </View>

      {/* Legend */}
      <View style={{ marginTop: 8, gap: 0 }}>
        {slices.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.colors.border.hairline }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color, marginRight: 10 }} />
            <Text style={{ flex: 1, color: theme.colors.text.primary, fontSize: 13, fontFamily: theme.typography.fontFamily.medium }}>
              {s.category}
            </Text>
            <Text style={{ color: theme.colors.text.secondary, fontSize: 12, marginRight: 10, fontFamily: theme.typography.fontFamily.body }}>
              {s.pct}%
            </Text>
            <Text style={{ color: theme.colors.text.primary, fontSize: 13, fontFamily: theme.typography.fontFamily.display }}>
              {s.amount.toFixed(2)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── BarChart ─────────────────────────────────────────────────────────────────

export interface BarItem { month?: string; week?: string; name?: string; amount: number; paid?: number }

export function BarChart({ data, height = 180, showPaid = false }: { data: BarItem[]; height?: number; showPaid?: boolean }) {
  const theme = useTheme();
  const max = Math.max(...data.map((d) => Math.max(d.amount, d.paid ?? 0)), 1);
  const padding = { left: 40, bottom: 28, top: 12, right: 8 };
  const chartH = height - padding.top - padding.bottom;
  const totalWidth = 320;
  const chartW = totalWidth - padding.left - padding.right;
  const barGroupW = chartW / Math.max(data.length, 1);
  const barW = Math.min(showPaid ? barGroupW * 0.35 : barGroupW * 0.55, 32);

  // Y-axis grid lines
  const gridLines = [0.25, 0.5, 0.75, 1].map((p) => ({
    y: padding.top + chartH * (1 - p),
    label: Math.round(max * p),
  }));

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={totalWidth} height={height}>
        <Defs>
          <SvgGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.colors.accent.primary} stopOpacity="1" />
            <Stop offset="1" stopColor={theme.colors.accent.primary} stopOpacity="0.5" />
          </SvgGradient>
          <SvgGradient id="barGrad2" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.colors.accent.secondary} stopOpacity="1" />
            <Stop offset="1" stopColor={theme.colors.accent.secondary} stopOpacity="0.4" />
          </SvgGradient>
        </Defs>

        {/* Grid lines */}
        {gridLines.map(({ y, label }, i) => (
          <G key={i}>
            <Line x1={padding.left} y1={y} x2={totalWidth - padding.right} y2={y} stroke={theme.colors.border.hairline} strokeWidth={0.5} />
            <SvgText x={padding.left - 4} y={y + 4} textAnchor="end" fill={theme.colors.text.tertiary} fontSize={9}>
              {label}
            </SvgText>
          </G>
        ))}

        {/* Bars */}
        {data.map((item, idx) => {
          const cx = padding.left + barGroupW * idx + barGroupW / 2;
          const bh = Math.max((item.amount / max) * chartH, 2);
          const by = padding.top + chartH - bh;
          const label = item.month?.slice(5) ?? item.week?.slice(5) ?? item.name ?? '';
          return (
            <G key={idx}>
              {showPaid && item.paid !== undefined && item.paid > 0 ? (
                <>
                  <Rect x={cx - barW - 2} y={padding.top + chartH - Math.max((item.paid / max) * chartH, 2)} width={barW} height={Math.max((item.paid / max) * chartH, 2)} rx={4} fill="url(#barGrad2)" />
                  <Rect x={cx + 2} y={by} width={barW} height={bh} rx={4} fill="url(#barGrad)" />
                </>
              ) : (
                <Rect x={cx - barW / 2} y={by} width={barW} height={bh} rx={4} fill="url(#barGrad)" />
              )}
              <SvgText x={cx} y={height - padding.bottom + 14} textAnchor="middle" fill={theme.colors.text.tertiary} fontSize={9}>
                {label.length > 5 ? label.slice(0, 5) : label}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      {showPaid && (
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: theme.colors.accent.primary }} />
            <Text style={{ color: theme.colors.text.secondary, fontSize: 11 }}>Your share</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: theme.colors.accent.secondary }} />
            <Text style={{ color: theme.colors.text.secondary, fontSize: 11 }}>You paid</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── LineChart ────────────────────────────────────────────────────────────────

export function LineChart({ data, height = 160 }: { data: { month?: string; week?: string; amount: number }[]; height?: number }) {
  const theme = useTheme();
  if (data.length < 2) return <BarChart data={data} height={height} />;

  const padding = { left: 40, bottom: 28, top: 16, right: 12 };
  const totalWidth = 320;
  const chartH = height - padding.top - padding.bottom;
  const chartW = totalWidth - padding.left - padding.right;
  const max = Math.max(...data.map((d) => d.amount), 1);
  const min = Math.min(...data.map((d) => d.amount));

  const toX = (i: number) => padding.left + (i / (data.length - 1)) * chartW;
  const toY = (v: number) => padding.top + chartH - ((v - min) / (max - min || 1)) * chartH;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(d.amount)}`).join(' ');
  const areaPath = `${linePath} L ${toX(data.length - 1)} ${padding.top + chartH} L ${padding.left} ${padding.top + chartH} Z`;

  const gridLines = [0, 0.5, 1].map((p) => ({
    y: padding.top + chartH * (1 - p),
    label: Math.round(min + (max - min) * p),
  }));

  return (
    <Svg width={totalWidth} height={height}>
      <Defs>
        <SvgGradient id="lineArea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={theme.colors.accent.primary} stopOpacity="0.25" />
          <Stop offset="1" stopColor={theme.colors.accent.primary} stopOpacity="0" />
        </SvgGradient>
      </Defs>

      {gridLines.map(({ y, label }, i) => (
        <G key={i}>
          <Line x1={padding.left} y1={y} x2={totalWidth - padding.right} y2={y} stroke={theme.colors.border.hairline} strokeWidth={0.5} />
          <SvgText x={padding.left - 4} y={y + 4} textAnchor="end" fill={theme.colors.text.tertiary} fontSize={9}>{label}</SvgText>
        </G>
      ))}

      <Path d={areaPath} fill="url(#lineArea)" />
      <Path d={linePath} fill="none" stroke={theme.colors.accent.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

      {data.map((d, i) => {
        const label = d.month?.slice(5) ?? d.week?.slice(5) ?? '';
        return (
          <G key={i}>
            <Circle cx={toX(i)} cy={toY(d.amount)} r={4} fill={theme.colors.accent.primary} />
            <Circle cx={toX(i)} cy={toY(d.amount)} r={2} fill={theme.colors.background.secondary} />
            {(i === 0 || i === data.length - 1 || data.length <= 6) && (
              <SvgText x={toX(i)} y={height - padding.bottom + 14} textAnchor="middle" fill={theme.colors.text.tertiary} fontSize={9}>{label}</SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

// ─── HorizontalBarChart (for group breakdown) ─────────────────────────────────

export function HorizontalBarChart({ data }: { data: { name: string; amount: number; count: number }[] }) {
  const theme = useTheme();
  const colors = useChartColors();
  const max = Math.max(...data.map((d) => d.amount), 1);

  return (
    <View style={{ gap: 12 }}>
      {data.map((item, i) => (
        <View key={i}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
            <Text style={{ color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium, fontSize: 13 }} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={{ color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body, fontSize: 12 }}>
              {item.amount.toFixed(2)} · {item.count} expense{item.count !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={{ height: 8, backgroundColor: theme.colors.background.tertiary, borderRadius: 4, overflow: 'hidden' }}>
            <View
              style={{
                height: 8,
                width: `${(item.amount / max) * 100}%`,
                backgroundColor: colors[i % colors.length],
                borderRadius: 4,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
