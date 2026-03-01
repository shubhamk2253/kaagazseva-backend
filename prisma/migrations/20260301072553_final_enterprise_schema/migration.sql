-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "method" TEXT,
ADD COLUMN     "success" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "metadata" JSONB;
