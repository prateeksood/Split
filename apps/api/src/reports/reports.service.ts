import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';

export type DateRange = '7d' | '30d' | '90d' | '6m' | '1y' | 'all';

function rangeStart(range: DateRange): Date | undefined {
  if (range === 'all') return undefined;
  const d = new Date();
  switch (range) {
    case '7d':  d.setDate(d.getDate() - 7); break;
    case '30d': d.setDate(d.getDate() - 30); break;
    case '90d': d.setDate(d.getDate() - 90); break;
    case '6m':  d.setMonth(d.getMonth() - 6); break;
    case '1y':  d.setFullYear(d.getFullYear() - 1); break;
  }
  return d;
}

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private groups: GroupsService,
  ) {}

  // ─── Category breakdown ───────────────────────────────────────────────────

  async categoryBreakdown(userId: string, groupId?: string, range: DateRange = 'all') {
    const expenses = await this.getUserExpenses(userId, groupId, range);
    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
      const share = e.splits.find((s) => s.userId === userId)?.amount.toNumber() ?? 0;
      byCategory[e.category] = (byCategory[e.category] ?? 0) + share;
    }
    return Object.entries(byCategory)
      .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);
  }

  // ─── Monthly trend ────────────────────────────────────────────────────────

  async monthlyTrend(userId: string, groupId?: string, range: DateRange = '1y') {
    const expenses = await this.getUserExpenses(userId, groupId, range);
    const byMonth: Record<string, { total: number; paid: number }> = {};
    for (const e of expenses) {
      const share = e.splits.find((s) => s.userId === userId)?.amount.toNumber() ?? 0;
      const paid = e.paidById === userId ? e.amount.toNumber() : 0;
      const key = e.date.toISOString().slice(0, 7);
      if (!byMonth[key]) byMonth[key] = { total: 0, paid: 0 };
      byMonth[key].total += share;
      byMonth[key].paid += paid;
    }
    return Object.entries(byMonth)
      .map(([month, { total, paid }]) => ({
        month,
        amount: Math.round(total * 100) / 100,
        paid: Math.round(paid * 100) / 100,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  // ─── Weekly trend (for short date ranges) ────────────────────────────────

  async weeklyTrend(userId: string, groupId?: string, range: DateRange = '30d') {
    const expenses = await this.getUserExpenses(userId, groupId, range);
    const byWeek: Record<string, number> = {};
    for (const e of expenses) {
      const share = e.splits.find((s) => s.userId === userId)?.amount.toNumber() ?? 0;
      const d = new Date(e.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      byWeek[key] = (byWeek[key] ?? 0) + share;
    }
    return Object.entries(byWeek)
      .map(([week, amount]) => ({ week, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }

  // ─── Per-group breakdown ──────────────────────────────────────────────────

  async groupBreakdown(userId: string, range: DateRange = 'all') {
    const expenses = await this.getUserExpenses(userId, undefined, range);
    const byGroup: Record<string, { name: string; amount: number; count: number }> = {};
    for (const e of expenses) {
      const share = e.splits.find((s) => s.userId === userId)?.amount.toNumber() ?? 0;
      if (!byGroup[e.groupId]) byGroup[e.groupId] = { name: e.group.name, amount: 0, count: 0 };
      byGroup[e.groupId].amount += share;
      byGroup[e.groupId].count += 1;
    }
    return Object.entries(byGroup)
      .map(([groupId, { name, amount, count }]) => ({
        groupId,
        name,
        amount: Math.round(amount * 100) / 100,
        count,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  // ─── Smart insights ───────────────────────────────────────────────────────

  async smartInsights(userId: string, range: DateRange = '30d') {
    const [current, previous] = await Promise.all([
      this.getUserExpenses(userId, undefined, range),
      this.getUserExpenses(userId, undefined, this.previousRange(range)),
    ]);

    const insights: { type: string; title: string; body: string; positive?: boolean }[] = [];

    const currTotal = current.reduce(
      (s, e) => s + (e.splits.find((sp) => sp.userId === userId)?.amount.toNumber() ?? 0), 0,
    );
    const prevTotal = previous.reduce(
      (s, e) => s + (e.splits.find((sp) => sp.userId === userId)?.amount.toNumber() ?? 0), 0,
    );

    // Spending trend
    if (prevTotal > 0) {
      const change = Math.round(((currTotal - prevTotal) / prevTotal) * 100);
      if (Math.abs(change) >= 5) {
        insights.push({
          type: 'trend',
          title: change > 0 ? `Spending up ${Math.abs(change)}%` : `Spending down ${Math.abs(change)}%`,
          body: change > 0
            ? `You spent ${Math.abs(change)}% more than the previous period.`
            : `Great job! You spent ${Math.abs(change)}% less than the previous period.`,
          positive: change <= 0,
        });
      }
    }

    // Top category
    const byCategory: Record<string, number> = {};
    for (const e of current) {
      const share = e.splits.find((s) => s.userId === userId)?.amount.toNumber() ?? 0;
      byCategory[e.category] = (byCategory[e.category] ?? 0) + share;
    }
    const topCat = Object.entries(byCategory).sort(([, a], [, b]) => b - a)[0];
    if (topCat && currTotal > 0) {
      const pct = Math.round((topCat[1] / currTotal) * 100);
      insights.push({
        type: 'category',
        title: `${topCat[0]} is your top category`,
        body: `${pct}% of your spending this period is on ${topCat[0]}.`,
      });
    }

    // Most active group
    const byGroup: Record<string, { name: string; count: number }> = {};
    for (const e of current) {
      if (!byGroup[e.groupId]) byGroup[e.groupId] = { name: e.group.name, count: 0 };
      byGroup[e.groupId].count += 1;
    }
    const topGroup = Object.values(byGroup).sort((a, b) => b.count - a.count)[0];
    if (topGroup) {
      insights.push({
        type: 'group',
        title: `Most active: ${topGroup.name}`,
        body: `${topGroup.count} expense${topGroup.count !== 1 ? 's' : ''} recorded in this group this period.`,
      });
    }

    // Average per expense
    if (current.length > 0) {
      const avg = Math.round((currTotal / current.length) * 100) / 100;
      insights.push({
        type: 'average',
        title: `Average expense: ${avg.toFixed(2)}`,
        body: `Across ${current.length} expense${current.length !== 1 ? 's' : ''} this period.`,
      });
    }

    // Paid more than owed
    const totalPaid = current
      .filter((e) => e.paidById === userId)
      .reduce((s, e) => s + e.amount.toNumber(), 0);
    if (totalPaid > currTotal) {
      const net = Math.round((totalPaid - currTotal) * 100) / 100;
      insights.push({
        type: 'owed',
        title: `Others owe you`,
        body: `You've paid ${net.toFixed(2)} more than your share this period.`,
        positive: true,
      });
    } else if (currTotal > totalPaid) {
      const net = Math.round((currTotal - totalPaid) * 100) / 100;
      insights.push({
        type: 'owed',
        title: `You owe net ${net.toFixed(2)}`,
        body: `Your share exceeds what you've paid so far this period.`,
        positive: false,
      });
    }

    return { insights, totalSpend: Math.round(currTotal * 100) / 100, expenseCount: current.length };
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  async exportCsv(userId: string, groupId?: string) {
    const expenses = await this.getUserExpenses(userId, groupId, 'all');
    const header = 'Date,Description,Category,Amount,Currency,Group,Your Share\n';
    const rows = expenses.map((e) => {
      const share = e.splits.find((s) => s.userId === userId)?.amount.toNumber() ?? 0;
      return [
        e.date.toISOString().slice(0, 10),
        `"${e.description.replace(/"/g, '""')}"`,
        e.category,
        e.amount.toNumber(),
        e.currency,
        `"${e.group.name}"`,
        share,
      ].join(',');
    });
    return { csv: header + rows.join('\n') };
  }

  async exportPdf(userId: string, groupId?: string): Promise<{ pdf: string; filename: string }> {
    const PDFDocument = (await import('pdfkit')).default;
    const expenses = await this.getUserExpenses(userId, groupId, 'all');
    const categories = await this.categoryBreakdown(userId, groupId, 'all');

    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    await new Promise<void>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve());
      doc.on('error', reject);
      doc.fontSize(22).fillColor('#7C6FFF').text('Split — Expense Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).fillColor('#666').text(`Generated ${new Date().toISOString().slice(0, 10)}`, { align: 'center' });
      doc.moveDown(1.5);
      doc.fontSize(14).fillColor('#0F0F14').text('Spending by Category');
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#333');
      for (const c of categories) doc.text(`${c.category}: ${c.amount.toFixed(2)}`);
      doc.moveDown(1.5);
      doc.fontSize(14).fillColor('#0F0F14').text('Transactions');
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#333');
      for (const e of expenses) {
        const share = e.splits.find((s) => s.userId === userId)?.amount.toNumber() ?? 0;
        doc.text(`${e.date.toISOString().slice(0, 10)}  ${e.description.slice(0, 40)}  ${e.category}  ${e.amount.toNumber()} ${e.currency}  (your share: ${share.toFixed(2)})`);
      }
      doc.end();
    });

    return { pdf: Buffer.concat(chunks).toString('base64'), filename: `split-report-${new Date().toISOString().slice(0, 10)}.pdf` };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private previousRange(range: DateRange): DateRange {
    switch (range) {
      case '7d': return '7d';
      case '30d': return '30d';
      case '90d': return '90d';
      case '6m': return '6m';
      case '1y': return '1y';
      default: return 'all';
    }
  }

  private async getUserExpenses(userId: string, groupId?: string, range: DateRange = 'all') {
    if (groupId) await this.groups.ensureMember(groupId, userId);
    const since = rangeStart(range);
    return this.prisma.expense.findMany({
      where: {
        deletedAt: null,
        ...(groupId ? { groupId } : { group: { members: { some: { userId } } } }),
        splits: { some: { userId } },
        ...(since ? { date: { gte: since } } : {}),
      },
      include: {
        splits: true,
        group: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    });
  }
}
