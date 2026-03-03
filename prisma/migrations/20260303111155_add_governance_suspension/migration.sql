-- CreateEnum
CREATE TYPE "SuspensionStatus" AS ENUM ('NONE', 'PENDING', 'CONFIRMED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "suspensionStatus" "SuspensionStatus" NOT NULL DEFAULT 'NONE';
