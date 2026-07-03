-- CreateTable
CREATE TABLE "expense_audit_logs" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2),
    "category" TEXT,
    "paidById" TEXT,
    "splitType" TEXT,
    "diff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_parse_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_parse_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expense_audit_logs_expenseId_idx" ON "expense_audit_logs"("expenseId");

-- CreateIndex
CREATE INDEX "expense_audit_logs_groupId_createdAt_idx" ON "expense_audit_logs"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "expense_audit_logs_actorId_idx" ON "expense_audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "ai_parse_logs_createdAt_idx" ON "ai_parse_logs"("createdAt");

-- CreateIndex
CREATE INDEX "ai_parse_logs_provider_idx" ON "ai_parse_logs"("provider");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "email_verification_tokens_userId_idx" ON "email_verification_tokens"("userId");

-- CreateIndex
CREATE INDEX "email_verification_tokens_expiresAt_idx" ON "email_verification_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "groups_deletedAt_idx" ON "groups"("deletedAt");

-- CreateIndex
CREATE INDEX "group_members_userId_idx" ON "group_members"("userId");

-- CreateIndex
CREATE INDEX "expenses_groupId_deletedAt_date_idx" ON "expenses"("groupId", "deletedAt", "date");

-- CreateIndex
CREATE INDEX "expenses_paidById_idx" ON "expenses"("paidById");

-- CreateIndex
CREATE INDEX "expense_splits_userId_idx" ON "expense_splits"("userId");

-- CreateIndex
CREATE INDEX "settlements_payerId_createdAt_idx" ON "settlements"("payerId", "createdAt");

-- CreateIndex
CREATE INDEX "settlements_payeeId_createdAt_idx" ON "settlements"("payeeId", "createdAt");

-- CreateIndex
CREATE INDEX "settlements_groupId_idx" ON "settlements"("groupId");

-- CreateIndex
CREATE INDEX "friendships_status_idx" ON "friendships"("status");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- AddForeignKey
ALTER TABLE "expense_audit_logs" ADD CONSTRAINT "expense_audit_logs_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_audit_logs" ADD CONSTRAINT "expense_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_audit_logs" ADD CONSTRAINT "expense_audit_logs_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
