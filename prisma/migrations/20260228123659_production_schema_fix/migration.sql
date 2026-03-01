/*
  Warnings:

  - You are about to drop the column `gatewayOrderId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `gatewayPaymentId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the `AuditLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Ticket` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TicketResponse` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `agentCommission` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `district` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `govtFee` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mode` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `platformCommission` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serviceFee` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAmount` to the `Application` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ServiceMode" AS ENUM ('DIGITAL', 'DOORSTEP');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApplicationStatus" ADD VALUE 'ASSIGNED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
ALTER TYPE "TransactionStatus" ADD VALUE 'REFUNDED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'ESCROW_HOLD';
ALTER TYPE "TransactionType" ADD VALUE 'ESCROW_RELEASE';
ALTER TYPE "TransactionType" ADD VALUE 'REFUND';

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_assignedTo_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_userId_fkey";

-- DropForeignKey
ALTER TABLE "TicketResponse" DROP CONSTRAINT "TicketResponse_senderId_fkey";

-- DropForeignKey
ALTER TABLE "TicketResponse" DROP CONSTRAINT "TicketResponse_ticketId_fkey";

-- DropIndex
DROP INDEX "Application_createdAt_idx";

-- DropIndex
DROP INDEX "Transaction_gatewayOrderId_key";

-- DropIndex
DROP INDEX "Transaction_gatewayPaymentId_key";

-- DropIndex
DROP INDEX "User_phoneNumber_idx";

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "agentCommission" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignmentDeadline" TIMESTAMP(3),
ADD COLUMN     "autoReleaseAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "customerLat" DOUBLE PRECISION,
ADD COLUMN     "customerLng" DOUBLE PRECISION,
ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
ADD COLUMN     "distanceKm" DOUBLE PRECISION,
ADD COLUMN     "district" TEXT NOT NULL,
ADD COLUMN     "govtFee" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "manualReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mode" "ServiceMode" NOT NULL,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentStatus" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "platformCommission" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "pricingSnapshot" JSONB,
ADD COLUMN     "refundRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "riskScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "serviceFee" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "state" TEXT NOT NULL,
ADD COLUMN     "totalAmount" DECIMAL(12,2) NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "gatewayOrderId",
DROP COLUMN "gatewayPaymentId";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "district" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "state" TEXT;

-- DropTable
DROP TABLE "AuditLog";

-- DropTable
DROP TABLE "Ticket";

-- DropTable
DROP TABLE "TicketResponse";

-- DropEnum
DROP TYPE "AuditAction";

-- DropEnum
DROP TYPE "TicketCategory";

-- DropEnum
DROP TYPE "TicketPriority";

-- DropEnum
DROP TYPE "TicketStatus";

-- CreateTable
CREATE TABLE "EscrowHolding" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "agentId" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "platformAmount" DECIMAL(12,2) NOT NULL,
    "agentAmount" DECIMAL(12,2) NOT NULL,
    "isReleased" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMetrics" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "activeCases" INTEGER NOT NULL DEFAULT 0,
    "completedCases" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "rejectionCount" INTEGER NOT NULL DEFAULT 0,
    "timeoutCount" INTEGER NOT NULL DEFAULT 0,
    "priorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "processedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EscrowHolding_applicationId_key" ON "EscrowHolding"("applicationId");

-- CreateIndex
CREATE INDEX "EscrowHolding_customerId_idx" ON "EscrowHolding"("customerId");

-- CreateIndex
CREATE INDEX "EscrowHolding_agentId_idx" ON "EscrowHolding"("agentId");

-- CreateIndex
CREATE INDEX "EscrowHolding_isReleased_idx" ON "EscrowHolding"("isReleased");

-- CreateIndex
CREATE UNIQUE INDEX "AgentMetrics_agentId_key" ON "AgentMetrics"("agentId");

-- CreateIndex
CREATE INDEX "Withdrawal_agentId_idx" ON "Withdrawal"("agentId");

-- CreateIndex
CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");

-- CreateIndex
CREATE INDEX "Withdrawal_createdAt_idx" ON "Withdrawal"("createdAt");

-- CreateIndex
CREATE INDEX "Application_state_idx" ON "Application"("state");

-- CreateIndex
CREATE INDEX "Application_district_idx" ON "Application"("district");

-- CreateIndex
CREATE INDEX "Application_assignmentDeadline_idx" ON "Application"("assignmentDeadline");

-- CreateIndex
CREATE INDEX "Application_paymentStatus_idx" ON "Application"("paymentStatus");

-- CreateIndex
CREATE INDEX "Application_riskScore_idx" ON "Application"("riskScore");

-- CreateIndex
CREATE INDEX "User_state_idx" ON "User"("state");

-- CreateIndex
CREATE INDEX "User_district_idx" ON "User"("district");

-- AddForeignKey
ALTER TABLE "EscrowHolding" ADD CONSTRAINT "EscrowHolding_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowHolding" ADD CONSTRAINT "EscrowHolding_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowHolding" ADD CONSTRAINT "EscrowHolding_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMetrics" ADD CONSTRAINT "AgentMetrics_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
