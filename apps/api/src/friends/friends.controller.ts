import { Body, Controller, Get, Post, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

const FRIENDS_THROTTLE = { default: { limit: 20, ttl: 60000 } };

@ApiTags('friends')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
  constructor(private friends: FriendsService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.friends.listWithBalances(userId);
  }

  @Post()
  @Throttle(FRIENDS_THROTTLE)
  add(@CurrentUser('id') userId: string, @Body() body: unknown) {
    return this.friends.addFriend(userId, body);
  }

  @Get('invite')
  inviteLink(@CurrentUser('id') userId: string) {
    return this.friends.getInviteLink(userId);
  }

  @Post('accept-invite')
  @Throttle(FRIENDS_THROTTLE)
  acceptInvite(@CurrentUser('id') userId: string, @Body('ref') ref: unknown) {
    if (typeof ref !== 'string' || ref.trim().length === 0 || ref.length > 64) {
      throw new BadRequestException('A valid invite reference is required');
    }
    return this.friends.acceptInvite(userId, ref.trim());
  }
}
