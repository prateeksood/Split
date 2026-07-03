import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { execSync } from 'child_process';
import { join } from 'path';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { AIService } from '../../src/ai/ai.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import type { ParsedExpense } from '@split/shared';

const mockParsedExpense: ParsedExpense = {
  payer: 'You',
  amount: 600,
  currency: 'INR',
  date: 'today',
  description: 'Dinner',
  category: 'Food',
  participants: ['You', 'Rahul'],
  split_type: 'equal',
  split_values: null,
  group_hint: 'Test Group',
  confidence: { payer: 0.9, amount: 0.95, participants: 0.8, split_type: 0.9 },
  ambiguities: [],
};

describe('Expense flow (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let groupId: string;
  let userId: string;
  let memberId: string;

  let testUserEmail: string;
  let memberEmail: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = 'postgresql://split:split_test@localhost:5432/split_test?schema=public';
    }
    process.env.DIRECT_DATABASE_URL = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-min-16chars';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-min16';
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
    process.env.NODE_ENV = 'test';

    execSync('npx prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      stdio: 'inherit',
      env: process.env as NodeJS.ProcessEnv,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AIService)
      .useValue({
        parseExpense: async () => mockParsedExpense,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const suffix = Date.now();
    testUserEmail = `test-${suffix}@example.com`;
    const user = await prisma.user.create({
      data: {
        email: testUserEmail,
        name: 'Test User',
        passwordHash: '$2b$12$placeholder',
        defaultCurrency: 'INR',
      },
    });
    userId = user.id;

    memberEmail = `member-${suffix}@example.com`;
    const member = await prisma.user.create({
      data: {
        email: memberEmail,
        name: 'Rahul',
        passwordHash: '$2b$12$placeholder',
        defaultCurrency: 'INR',
      },
    });
    memberId = member.id;

    const group = await prisma.group.create({
      data: {
        name: 'Test Group',
        category: 'Friends',
        color: '#7C6FFF',
        currency: 'INR',
        inviteCode: 'TESTGRP1',
        createdBy: userId,
        members: {
          create: [
            { userId, role: 'admin' },
            { userId: memberId },
          ],
        },
      },
    });
    groupId = group.id;

    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('password123', 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });

    const auth = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'password123' })
      .expect(200);

    accessToken = auth.body.accessToken;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.expenseSplit.deleteMany({ where: { expense: { groupId } } });
      await prisma.expense.deleteMany({ where: { groupId } });
      await prisma.groupMember.deleteMany({ where: { groupId } });
      await prisma.group.deleteMany({ where: { id: groupId } });
      await prisma.user.deleteMany({ where: { email: { in: [testUserEmail, memberEmail] } } });
    }
    await app?.close();
  });

  it('parses NL expense via AI endpoint', async () => {
    const res = await request(app.getHttpServer())
      .post('/ai/parse-expense')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: 'Paid 600 for dinner with Rahul', groupId })
      .expect(201);

    expect(res.body.amount).toBe(600);
    expect(res.body.description).toBe('Dinner');
  });

  it('rejects client-supplied context field', async () => {
    await request(app.getHttpServer())
      .post('/ai/parse-expense')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        text: 'Paid 600 for dinner with Rahul',
        groupId,
        context: {
          memberNames: ['Fake Person'],
          defaultCurrency: 'USD',
        },
      })
      .expect(400);
  });

  it('creates expense and updates group balances', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/expenses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        groupId,
        description: 'Dinner',
        amount: 600,
        category: 'Food',
        paidById: userId,
        splitType: 'equal',
        splits: [
          { userId, amount: 300 },
          { userId: memberId, amount: 300 },
        ],
      })
      .expect(201);

    expect(createRes.body.description).toBe('Dinner');

    const groupRes = await request(app.getHttpServer())
      .get(`/groups/${groupId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(groupRes.body.expenses.length).toBeGreaterThan(0);
    expect(groupRes.body.balances[memberId]).toBe(-300);
  });

  it('full NL parse → save flow', async () => {
    const parsed = await request(app.getHttpServer())
      .post('/ai/parse-expense')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: 'I paid 400 for lunch split equally', groupId })
      .expect(201);

    const amount = parsed.body.amount as number;
    const perPerson = amount / 2;

    await request(app.getHttpServer())
      .post('/expenses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        groupId,
        description: parsed.body.description,
        amount,
        category: parsed.body.category,
        paidById: userId,
        splitType: 'equal',
        splits: [
          { userId, amount: perPerson },
          { userId: memberId, amount: perPerson },
        ],
      })
      .expect(201);

    const dashboard = await request(app.getHttpServer())
      .get('/users/dashboard')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(dashboard.body.recentActivity.length).toBeGreaterThan(0);
  });
});
