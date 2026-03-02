-- DropIndex
DROP INDEX "Application_district_idx";

-- DropIndex
DROP INDEX "Application_paymentStatus_idx";

-- DropIndex
DROP INDEX "Application_state_idx";

-- DropIndex
DROP INDEX "User_createdAt_idx";

-- DropIndex
DROP INDEX "User_isActive_idx";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "ip" TEXT,
ADD COLUMN     "path" TEXT,
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "statusCode" INTEGER,
ADD COLUMN     "userAgent" TEXT;

-- CreateTable
CREATE TABLE "Otp" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Otp_mobile_idx" ON "Otp"("mobile");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_idx" ON "AuditLog"("resourceType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "EscrowHolding_customerId_idx" ON "EscrowHolding"("customerId");

-- CreateIndex
CREATE INDEX "EscrowHolding_agentId_idx" ON "EscrowHolding"("agentId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Ticket_createdById_idx" ON "Ticket"("createdById");

-- CreateIndex
CREATE INDEX "Ticket_assignedToId_idx" ON "Ticket"("assignedToId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "TicketResponse_ticketId_idx" ON "TicketResponse"("ticketId");

-- CreateIndex
CREATE INDEX "TicketResponse_userId_idx" ON "TicketResponse"("userId");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Withdrawal_agentId_idx" ON "Withdrawal"("agentId");

-- CreateIndex
CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");
