import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@CurrentUser('id') userId: string) {
    return this.users.getProfile(userId);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard summary' })
  getDashboard(@CurrentUser('id') userId: string) {
    return this.users.getDashboard(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update profile' })
  updateProfile(@CurrentUser('id') userId: string, @Body() body: unknown) {
    return this.users.updateProfile(userId, body);
  }
}
