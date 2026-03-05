-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "escalationLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "manualReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "refundRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "riskScore" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "ip" TEXT,
ADD COLUMN     "method" TEXT,
ADD COLUMN     "newData" JSONB,
ADD COLUMN     "oldData" JSONB,
ADD COLUMN     "path" TEXT,
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "statusCode" INTEGER,
ADD COLUMN     "success" BOOLEAN DEFAULT true,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "SuspensionCase" ADD COLUMN     "appealAt" TIMESTAMP(3),
ADD COLUMN     "appealMessage" TEXT,
ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 0;
