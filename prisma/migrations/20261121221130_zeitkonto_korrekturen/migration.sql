/*
  Warnings:

  - You are about to drop the column `supersededById` on the `TimeEntry` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "TimeEntry" DROP CONSTRAINT "TimeEntry_supersededById_fkey";

-- DropIndex
DROP INDEX "TimeEntry_supersededById_key";

-- AlterTable
ALTER TABLE "CorrectionRequest" ADD COLUMN     "correctionId" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "timeAccountStart" DATE;

-- AlterTable
ALTER TABLE "TimeEntry" DROP COLUMN "supersededById",
ADD COLUMN     "correctionId" TEXT;

-- CreateIndex
CREATE INDEX "TimeEntry_correctionId_idx" ON "TimeEntry"("correctionId");
