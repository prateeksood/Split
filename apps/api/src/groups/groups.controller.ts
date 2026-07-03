import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private groups: GroupsService) {}

  @Get()
  @ApiOperation({ summary: 'List user groups with balances' })
  findAll(@CurrentUser('id') userId: string) {
    return this.groups.findAllForUser(userId);
  }

  @Get('join/:code')
  @ApiOperation({ summary: 'Preview a group invite by code' })
  previewJoin(@Param('code') code: string, @CurrentUser('id') userId: string) {
    return this.groups.previewJoin(code, userId);
  }

  @Post('join')
  @ApiOperation({ summary: 'Join a group using an invite code or link' })
  joinByInvite(@CurrentUser('id') userId: string, @Body() body: unknown) {
    return this.groups.joinByInvite(userId, body);
  }

  @Get(':id/invite')
  @ApiOperation({ summary: 'Get group invite link and code' })
  getInvite(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.groups.getInvite(id, userId);
  }

  @Post(':id/invite/regenerate')
  @ApiOperation({ summary: 'Regenerate group invite code (admin only)' })
  regenerateInvite(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.groups.regenerateInvite(id, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get group details with balances' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.groups.findOne(id, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new group' })
  create(@CurrentUser('id') userId: string, @Body() body: unknown) {
    return this.groups.create(userId, body);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add member to group by email' })
  addMember(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() body: unknown) {
    return this.groups.addMember(id, userId, body);
  }

  @Patch(':id/members/:userId/role')
  @ApiOperation({ summary: 'Change a member role (admin only)' })
  updateMemberRole(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser('id') userId: string,
    @Body() body: unknown,
  ) {
    return this.groups.updateMemberRole(id, userId, targetUserId, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update group settings (admin only)' })
  update(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() body: unknown) {
    return this.groups.updateGroup(id, userId, body);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove a member from the group, or leave (use own userId)' })
  removeMember(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.groups.removeMember(id, userId, targetUserId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete / archive a group (admin only)' })
  archive(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.groups.archive(id, userId);
  }
}
