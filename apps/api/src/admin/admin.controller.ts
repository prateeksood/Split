import { Controller, Get, Post, Delete, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // ─── Stats ───────────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Platform-wide stats' })
  stats() {
    return this.admin.getStats();
  }

  @Get('stats/ai')
  @ApiOperation({ summary: 'AI usage stats by provider' })
  aiStats() {
    return this.admin.getAiStats();
  }

  // ─── Logs ────────────────────────────────────────────────────────────────

  @Get('logs/signups')
  @ApiOperation({ summary: 'Recent signups' })
  recentSignups(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    return this.admin.getRecentSignups(Math.min(limit, 100));
  }

  @Get('logs/logins')
  @ApiOperation({ summary: 'Recent login sessions' })
  recentLogins(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    return this.admin.getRecentLogins(Math.min(limit, 100));
  }

  // ─── Users ───────────────────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'List all users (paginated, searchable)' })
  listUsers(
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const parsed =
      status === 'active' || status === 'deactivated' || status === 'all' ? status : 'all';
    return this.admin.listUsers(page, Math.min(limit, 100), search, parsed);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user detail with memberships' })
  getUser(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Deactivate a user account' })
  deactivateUser(@Param('id') id: string) {
    return this.admin.deactivateUser(id);
  }

  @Post('users/:id/reactivate')
  @ApiOperation({ summary: 'Reactivate a deactivated user' })
  reactivateUser(@Param('id') id: string) {
    return this.admin.reactivateUser(id);
  }

  @Post('users/:id/purge')
  @ApiOperation({ summary: 'Permanently purge account (anonymize, free email for re-registration)' })
  purgeUser(@Param('id') id: string, @CurrentUser('id') callerId: string) {
    return this.admin.purgeUser(id, callerId);
  }

  @Post('users/:id/send-verification')
  @ApiOperation({ summary: 'Manually send verification email to a user' })
  sendVerification(@Param('id') id: string) {
    return this.admin.sendVerificationEmail(id);
  }
}
