import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;

const presignSchema = z.object({
  contentType: z.enum(ALLOWED_IMAGE_TYPES).default('image/jpeg'),
});

@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class StorageController {
  constructor(private storage: StorageService) {}

  @Post('receipt/presign')
  @ApiOperation({ summary: 'Get presigned URL for receipt upload' })
  async presignReceipt(@CurrentUser('id') userId: string, @Body() body: unknown) {
    const { contentType } = presignSchema.parse(body);
    return this.storage.createReceiptUploadUrl(userId, contentType);
  }
}
