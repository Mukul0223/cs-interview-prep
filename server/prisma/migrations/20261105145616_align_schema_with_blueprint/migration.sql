/*
  Warnings:

  - The `status` column on the `QuizRun` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `explanation` on table `Question` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('IN_PROGRESS', 'FAILED', 'COMPLETED', 'ABANDONED');

-- AlterTable
ALTER TABLE "Question" ALTER COLUMN "explanation" SET NOT NULL;

-- AlterTable
ALTER TABLE "QuizRun" DROP COLUMN "status",
ADD COLUMN     "status" "RunStatus" NOT NULL DEFAULT 'IN_PROGRESS';

-- DropEnum
DROP TYPE "QuizStatus";
