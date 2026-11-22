-- AlterTable
ALTER TABLE "AbsenceRequest" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelRequestedAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT;
