-- AlterTable
ALTER TABLE "SickLeave" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "vacationRefundConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "vacationRefundConfirmedById" TEXT;
