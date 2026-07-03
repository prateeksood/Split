import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrencyService } from './currency.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const CURRENCY_CODE = /^[A-Za-z]{3}$/;

function normalizeCode(value: string, field: string): string {
  if (typeof value !== 'string' || !CURRENCY_CODE.test(value)) {
    throw new BadRequestException(`${field} must be a 3-letter currency code`);
  }
  return value.toUpperCase();
}

@ApiTags('currency')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('currency')
export class CurrencyController {
  constructor(private currency: CurrencyService) {}

  @Get('rates')
  rates(@Query('base') base = 'USD') {
    return this.currency.getRates(normalizeCode(base, 'base'));
  }

  @Get('convert')
  async convert(
    @Query('amount') amount: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 0 || numAmount > 1_000_000_000) {
      throw new BadRequestException('amount must be a number between 0 and 1,000,000,000');
    }
    const fromCode = normalizeCode(from, 'from');
    const toCode = normalizeCode(to, 'to');
    const result = await this.currency.convert(numAmount, fromCode, toCode);
    return { amount: numAmount, from: fromCode, to: toCode, result };
  }
}
