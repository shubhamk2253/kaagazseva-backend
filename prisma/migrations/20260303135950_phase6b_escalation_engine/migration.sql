/*
  Warnings:

  - The values [PENDING] on the enum `SuspensionStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SuspensionStatus_new" AS ENUM ('NONE', 'UNDER_REVIEW', 'CONFIRMED', 'REJECTED', 'ESCALATED', 'AUTO_ESCALATED');
ALTER TABLE "User" ALTER COLUMN "suspensionStatus" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "suspensionStatus" TYPE "SuspensionStatus_new" USING ("suspensionStatus"::text::"SuspensionStatus_new");
ALTER TABLE "SuspensionCase" ALTER COLUMN "status" TYPE "SuspensionStatus_new" USING ("status"::text::"SuspensionStatus_new");
ALTER TYPE "SuspensionStatus" RENAME TO "SuspensionStatus_old";
ALTER TYPE "SuspensionStatus_new" RENAME TO "SuspensionStatus";
DROP TYPE "SuspensionStatus_old";
ALTER TABLE "User" ALTER COLUMN "suspensionStatus" SET DEFAULT 'NONE';
COMMIT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "suspensionLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "suspensionReviewDeadline" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SuspensionCase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "level" INTEGER NOT NULL,
    "status" "SuspensionStatus" NOT NULL,
    "escalatedToId" TEXT,
    "resolvedById" TEXT,
    "appealMessage" TEXT,
    "appealAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuspensionCase_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SuspensionCase" ADD CONSTRAINT "SuspensionCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspensionCase" ADD CONSTRAINT "SuspensionCase_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspensionCase" ADD CONSTRAINT "SuspensionCase_escalatedToId_fkey" FOREIGN KEY ("escalatedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspensionCase" ADD CONSTRAINT "SuspensionCase_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
