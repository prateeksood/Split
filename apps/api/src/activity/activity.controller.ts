import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ActivityService, type ActivityKind } from './activity.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ApiTags('activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private activity: ActivityService) {}

  @Get()
  @ApiOperation({ summary: 'Unified, searchable, paginated activity feed across your groups' })
  feed(
    @CurrentUser('id') userId: string,
    @Query('q') q?: string,
    @Query('groupId') groupId?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (groupId && !UUID.test(groupId)) throw new BadRequestException('Invalid groupId');
    if (type && !['all', 'expense', 'settlement', 'member'].includes(type)) {
      throw new BadRequestException('type must be all, expense, settlement, or member');
    }
    const parsedPage = page ? Number(page) : 0;
    const parsedLimit = limit ? Number(limit) : 20;
    if (!Number.isFinite(parsedPage) || parsedPage < 0) throw new BadRequestException('Invalid page');
    if (!Number.isFinite(parsedLimit) || parsedLimit < 1) throw new BadRequestException('Invalid limit');

    return this.activity.feed(userId, {
      q: typeof q === 'string' ? q.slice(0, 100) : undefined,
      groupId,
      type: (type as ActivityKind | 'all') ?? 'all',
      page: parsedPage,
      limit: parsedLimit,
    });
  }
}
