-- AlterTable
ALTER TABLE "groups" ADD COLUMN "inviteCode" TEXT;

-- Backfill unique invite codes for existing groups
UPDATE "groups"
SET "inviteCode" = upper(substr(md5(random()::text || id::text), 1, 8))
WHERE "inviteCode" IS NULL;

ALTER TABLE "groups" ALTER COLUMN "inviteCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "groups_inviteCode_key" ON "groups"("inviteCode");
