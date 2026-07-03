import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ZodExceptionFilter } from './common/zod-exception.filter';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GroupsModule } from './groups/groups.module';
import { ExpensesModule } from './expenses/expenses.module';
import { SettlementsModule } from './settlements/settlements.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FriendsModule } from './friends/friends.module';
import { ReportsModule } from './reports/reports.module';
import { CurrencyModule } from './currency/currency.module';
import { ActivityModule } from './activity/activity.module';
import { AIModule } from './ai/ai.module';
import { EmailModule } from './email/email.module';
import { PushModule } from './push/push.module';
import { StorageModule } from './storage/storage.module';
import { HealthModule } from './health/health.module';
import { AdminModule } from './admin/admin.module';
import { validateEnv } from './config/env.validation';
import { loadMergedEnv } from './config/env.loader';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [() => loadMergedEnv()],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    EmailModule,
    PushModule,
    StorageModule,
    AuthModule,
    UsersModule,
    GroupsModule,
    ExpensesModule,
    SettlementsModule,
    NotificationsModule,
    FriendsModule,
    ReportsModule,
    CurrencyModule,
    ActivityModule,
    AIModule,
    HealthModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: ZodExceptionFilter },
  ],
})
export class AppModule {}
