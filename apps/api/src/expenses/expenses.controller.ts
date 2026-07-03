import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private expenses: ExpensesService) {}

  @Get('recent')
  @ApiOperation({ summary: 'Get recent expenses across all groups' })
  findRecent(@CurrentUser('id') userId: string) {
    return this.expenses.findRecentForUser(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new expense' })
  create(@CurrentUser('id') userId: string, @Body() body: unknown) {
    return this.expenses.create(userId, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an expense' })
  update(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() body: unknown) {
    return this.expenses.update(id, userId, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete an expense' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.expenses.softDelete(id, userId);
  }
}
