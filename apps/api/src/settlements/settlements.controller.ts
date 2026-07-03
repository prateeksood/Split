import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SettlementsService } from './settlements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('settlements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settlements')
export class SettlementsController {
  constructor(private settlements: SettlementsService) {}

  @Get()
  @ApiOperation({ summary: 'List settlements for current user (latest 50)' })
  findAll(@CurrentUser('id') userId: string) {
    return this.settlements.findForUser(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Record a settlement (caller must be the payer)' })
  create(@CurrentUser('id') userId: string, @Body() body: unknown) {
    return this.settlements.create(userId, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Void / delete a settlement (payer only)' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.settlements.delete(id, userId);
  }
}
