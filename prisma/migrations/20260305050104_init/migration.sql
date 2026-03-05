/*
  Warnings:

  - You are about to drop the column `acceptedAt` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `autoReleaseAt` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `distanceKm` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `documents` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `escalationLevel` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `manualReview` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `refundRequested` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `riskScore` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `ip` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `method` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `newData` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `oldData` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `path` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `requestId` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `statusCode` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `success` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `processedAt` on the `PaymentWebhookEvent` table. All the data in the column will be lost.
  - You are about to drop the column `govtFee` on the `Service` table. All the data in the column will be lost.
  - You are about to drop the column `appealAt` on the `SuspensionCase` table. All the data in the column will be lost.
  - You are about to drop the column `appealMessage` on the `SuspensionCase` table. All the data in the column will be lost.
  - You are about to drop the column `evidence` on the `SuspensionCase` table. All the data in the column will be lost.
  - You are about to drop the column `level` on the `SuspensionCase` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `SuspensionCase` table. All the data in the column will be lost.
  - You are about to drop the column `activatedAt` on the `SystemControl` table. All the data in the column will be lost.
  - You are about to drop the column `activatedBy` on the `SystemControl` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `SystemControl` table. All the data in the column will be lost.
  - You are about to drop the column `reason` on the `SystemControl` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slug]` on the table `Service` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idempotencyKey]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `Service` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'TIMEOUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- DropIndex
DROP INDEX "AuditLog_userId_idx";

-- DropIndex
DROP INDEX "Notification_userId_idx";

-- DropIndex
DROP INDEX "PaymentWebhookEvent_eventType_idx";

-- DropIndex
DROP INDEX "SuspensionCase_status_idx";

-- DropIndex
DROP INDEX "SuspensionCase_userId_idx";

-- AlterTable
ALTER TABLE "Application" DROP COLUMN "acceptedAt",
DROP COLUMN "autoReleaseAt",
DROP COLUMN "distanceKm",
DROP COLUMN "documents",
DROP COLUMN "escalationLevel",
DROP COLUMN "manualReview",
DROP COLUMN "refundRequested",
DROP COLUMN "riskScore";

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "ip",
DROP COLUMN "method",
DROP COLUMN "newData",
DROP COLUMN "oldData",
DROP COLUMN "path",
DROP COLUMN "requestId",
DROP COLUMN "statusCode",
DROP COLUMN "success",
DROP COLUMN "userAgent";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "metadata";

-- AlterTable
ALTER TABLE "PaymentWebhookEvent" DROP COLUMN "processedAt";

-- AlterTable
ALTER TABLE "Pincode" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Service" DROP COLUMN "govtFee",
ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ServiceRequiredDocument" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SuspensionCase" DROP COLUMN "appealAt",
DROP COLUMN "appealMessage",
DROP COLUMN "evidence",
DROP COLUMN "level",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "SystemControl" DROP COLUMN "activatedAt",
DROP COLUMN "activatedBy",
DROP COLUMN "createdAt",
DROP COLUMN "reason";

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "balanceAfter" DECIMAL(12,2),
ADD COLUMN     "balanceBefore" DECIMAL(12,2),
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "walletId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serviceRadiusKm" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "WithdrawalRequest" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- CreateTable
CREATE TABLE "ApplicationAssignment" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "responseReason" TEXT,
    "priorityScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "feedback" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationLog" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "ApplicationStatus" NOT NULL,
    "toStatus" "ApplicationStatus" NOT NULL,
    "note" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentService" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AgentService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "mode" "ServiceMode" NOT NULL,
    "minGovtFee" DECIMAL(12,2) NOT NULL,
    "maxGovtFee" DECIMAL(12,2) NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "serviceFee" DECIMAL(12,2),
    "platformCommission" DECIMAL(12,2),
    "agentCommission" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationAssignment_applicationId_idx" ON "ApplicationAssignment"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationAssignment_agentId_idx" ON "ApplicationAssignment"("agentId");

-- CreateIndex
CREATE INDEX "ApplicationAssignment_status_idx" ON "ApplicationAssignment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationAssignment_applicationId_agentId_key" ON "ApplicationAssignment"("applicationId", "agentId");

-- CreateIndex
CREATE INDEX "ApplicationDocument_applicationId_idx" ON "ApplicationDocument"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentService_agentId_serviceId_key" ON "AgentService"("agentId", "serviceId");

-- CreateIndex
CREATE INDEX "PricingRule_serviceId_idx" ON "PricingRule"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transaction_referenceId_idx" ON "Transaction"("referenceId");

-- CreateIndex
CREATE INDEX "Transaction_walletId_idx" ON "Transaction"("walletId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAssignment" ADD CONSTRAINT "ApplicationAssignment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAssignment" ADD CONSTRAINT "ApplicationAssignment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationLog" ADD CONSTRAINT "ApplicationLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentService" ADD CONSTRAINT "AgentService_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentService" ADD CONSTRAINT "AgentService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
