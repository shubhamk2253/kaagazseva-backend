-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSuspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedBy" TEXT,
ADD COLUMN     "suspensionReason" TEXT;

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false;
