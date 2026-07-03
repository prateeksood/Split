import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);

  const prateek = await prisma.user.upsert({
    where: { email: 'prateek@example.com' },
    update: { emailVerified: true },
    create: {
      email: 'prateek@example.com',
      name: 'Prateek',
      username: 'prateek',
      passwordHash,
      defaultCurrency: 'INR',
      emailVerified: true,
    },
  });

  const rahul = await prisma.user.upsert({
    where: { email: 'rahul@example.com' },
    update: { emailVerified: true },
    create: {
      email: 'rahul@example.com',
      name: 'Rahul Sharma',
      username: 'rahul',
      passwordHash,
      defaultCurrency: 'INR',
      emailVerified: true,
    },
  });

  const priya = await prisma.user.upsert({
    where: { email: 'priya@example.com' },
    update: { emailVerified: true },
    create: {
      email: 'priya@example.com',
      name: 'Priya Sharma',
      username: 'priya',
      passwordHash,
      defaultCurrency: 'INR',
      emailVerified: true,
    },
  });

  const goaTrip = await prisma.group.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Goa Trip',
      category: 'Trip',
      color: '#7C6FFF',
      currency: 'INR',
      inviteCode: 'GOATRIP1',
      createdBy: prateek.id,
      members: {
        create: [
          { userId: prateek.id, role: 'admin' },
          { userId: rahul.id },
          { userId: priya.id },
        ],
      },
    },
  });

  const flat = await prisma.group.upsert({
    where: { id: '00000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Flat 3B',
      category: 'Home',
      color: '#2DD4BF',
      currency: 'INR',
      inviteCode: 'FLAT3B2',
      createdBy: prateek.id,
      members: {
        create: [
          { userId: prateek.id, role: 'admin' },
          { userId: rahul.id },
        ],
      },
    },
  });

  await prisma.expense.createMany({
    skipDuplicates: true,
    data: [
      {
        id: '00000000-0000-4000-8000-000000000101',
        groupId: goaTrip.id,
        description: 'Dinner',
        amount: 1200,
        currency: 'INR',
        category: 'Food',
        paidById: prateek.id,
        splitType: 'equal',
        date: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        id: '00000000-0000-4000-8000-000000000102',
        groupId: flat.id,
        description: 'Groceries',
        amount: 600,
        currency: 'INR',
        category: 'Shopping',
        paidById: rahul.id,
        splitType: 'equal',
        date: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    ],
  });

  await prisma.expenseSplit.createMany({
    skipDuplicates: true,
    data: [
      { expenseId: '00000000-0000-4000-8000-000000000101', userId: prateek.id, amount: 400 },
      { expenseId: '00000000-0000-4000-8000-000000000101', userId: rahul.id, amount: 400 },
      { expenseId: '00000000-0000-4000-8000-000000000101', userId: priya.id, amount: 400 },
      { expenseId: '00000000-0000-4000-8000-000000000102', userId: prateek.id, amount: 300 },
      { expenseId: '00000000-0000-4000-8000-000000000102', userId: rahul.id, amount: 300 },
    ],
  });

  console.log('Seed complete:', { prateek: prateek.email, groups: [goaTrip.name, flat.name] });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
