import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService, DateRange } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

const VALID_RANGES: DateRange[] = ['7d', '30d', '90d', '6m', '1y', 'all'];
function parseRange(r: string | undefined): DateRange {
  return VALID_RANGES.includes(r as DateRange) ? (r as DateRange) : 'all';
}

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('categories')
  categories(
    @CurrentUser('id') userId: string,
    @Query('groupId') groupId?: string,
    @Query('range') range?: string,
  ) {
    return this.reports.categoryBreakdown(userId, groupId, parseRange(range));
  }

  @Get('monthly')
  monthly(
    @CurrentUser('id') userId: string,
    @Query('groupId') groupId?: string,
    @Query('range') range?: string,
  ) {
    return this.reports.monthlyTrend(userId, groupId, parseRange(range));
  }

  @Get('weekly')
  weekly(
    @CurrentUser('id') userId: string,
    @Query('groupId') groupId?: string,
    @Query('range') range?: string,
  ) {
    return this.reports.weeklyTrend(userId, groupId, parseRange(range));
  }

  @Get('groups')
  groups(
    @CurrentUser('id') userId: string,
    @Query('range') range?: string,
  ) {
    return this.reports.groupBreakdown(userId, parseRange(range));
  }

  @Get('insights')
  insights(
    @CurrentUser('id') userId: string,
    @Query('range') range?: string,
  ) {
    return this.reports.smartInsights(userId, parseRange(range));
  }

  @Get('export')
  exportCsv(@CurrentUser('id') userId: string, @Query('groupId') groupId?: string) {
    return this.reports.exportCsv(userId, groupId);
  }

  @Get('export/pdf')
  exportPdf(@CurrentUser('id') userId: string, @Query('groupId') groupId?: string) {
    return this.reports.exportPdf(userId, groupId);
  }
}
