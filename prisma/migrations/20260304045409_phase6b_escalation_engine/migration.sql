/*
  Warnings:

  - The values [PENDING] on the enum `SuspensionStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSED');

-- AlterEnum
BEGIN;
CREATE TYPE "SuspensionStatus_new" AS ENUM ('NONE', 'UNDER_REVIEW', 'CONFIRMED', 'REJECTED', 'ESCALATED', 'AUTO_ESCALATED');
ALTER TABLE "User" ALTER COLUMN "suspensionStatus" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "suspensionStatus" TYPE "SuspensionStatus_new" USING ("suspensionStatus"::text::"SuspensionStatus_new");
ALTER TYPE "SuspensionStatus" RENAME TO "SuspensionStatus_old";
ALTER TYPE "SuspensionStatus_new" RENAME TO "SuspensionStatus";
DROP TYPE "SuspensionStatus_old";
ALTER TABLE "User" ALTER COLUMN "suspensionStatus" SET DEFAULT 'NONE';
COMMIT;

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "serviceId" TEXT;

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

-- CreateTable
CREATE TABLE "RefundRequest" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemControl" (
    "id" TEXT NOT NULL,
    "paymentsFrozen" BOOLEAN NOT NULL DEFAULT false,
    "withdrawalsFrozen" BOOLEAN NOT NULL DEFAULT false,
    "refundsFrozen" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "activatedBy" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemControl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SuspensionCase_userId_idx" ON "SuspensionCase"("userId");

-- CreateIndex
CREATE INDEX "SuspensionCase_status_idx" ON "SuspensionCase"("status");

-- CreateIndex
CREATE INDEX "RefundRequest_applicationId_idx" ON "RefundRequest"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_eventId_key" ON "PaymentWebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_eventType_idx" ON "PaymentWebhookEvent"("eventType");

-- CreateIndex
CREATE INDEX "Application_serviceId_idx" ON "Application"("serviceId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "EscrowHolding_customerId_idx" ON "EscrowHolding"("customerId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Ticket_createdById_idx" ON "Ticket"("createdById");

-- CreateIndex
CREATE INDEX "TicketResponse_ticketId_idx" ON "TicketResponse"("ticketId");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_agentId_idx" ON "WithdrawalRequest"("agentId");

-- AddForeignKey
ALTER TABLE "SuspensionCase" ADD CONSTRAINT "SuspensionCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspensionCase" ADD CONSTRAINT "SuspensionCase_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspensionCase" ADD CONSTRAINT "SuspensionCase_escalatedToId_fkey" FOREIGN KEY ("escalatedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspensionCase" ADD CONSTRAINT "SuspensionCase_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
