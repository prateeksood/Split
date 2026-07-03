import { Injectable } from '@nestjs/common';

@Injectable()
export class CurrencyService {
  private cache = new Map<string, { rates: Record<string, number>; fetchedAt: number }>();
  private TTL = 60 * 60 * 1000;

  async convert(amount: number, from: string, to: string): Promise<number> {
    if (from === to) return amount;
    const rates = await this.getRates(from);
    const rate = rates[to];
    if (!rate) throw new Error(`No rate for ${from} → ${to}`);
    return Math.round(amount * rate * 100) / 100;
  }

  async getRates(base = 'USD'): Promise<Record<string, number>> {
    const cached = this.cache.get(base);
    if (cached && Date.now() - cached.fetchedAt < this.TTL) {
      return cached.rates;
    }

    const response = await fetch(`https://api.frankfurter.app/latest?from=${base}`);
    if (!response.ok) throw new Error('Failed to fetch exchange rates');

    const data = await response.json();
    const rates = { [base]: 1, ...data.rates };
    this.cache.set(base, { rates, fetchedAt: Date.now() });
    return rates;
  }
}
