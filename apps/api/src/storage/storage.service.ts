import { Injectable, ServiceUnavailableException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService implements OnModuleInit {
  private client: S3Client | null = null;
  private bucket: string | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const bucket = this.config.get('S3_BUCKET');
    const accessKey = this.config.get('S3_ACCESS_KEY');
    const secretKey = this.config.get('S3_SECRET_KEY');

    if (bucket && accessKey && secretKey) {
      this.bucket = bucket;
      this.client = new S3Client({
        region: this.config.get('S3_REGION', 'auto'),
        endpoint: this.config.get('S3_ENDPOINT') || undefined,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
        forcePathStyle: !!this.config.get('S3_ENDPOINT'),
      });
    }
  }

  isConfigured(): boolean {
    return this.client !== null && this.bucket !== null;
  }

  async createReceiptUploadUrl(userId: string, contentType: string): Promise<{ uploadUrl: string; receiptUrl: string }> {
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableException('Receipt storage is not configured');
    }

    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const key = `receipts/${userId}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 300 });
    const endpoint = this.config.get('S3_PUBLIC_URL');
    const receiptUrl = endpoint
      ? `${endpoint.replace(/\/$/, '')}/${key}`
      : `https://${this.bucket}.s3.${this.config.get('S3_REGION', 'auto')}.amazonaws.com/${key}`;

    return { uploadUrl, receiptUrl };
  }
}
