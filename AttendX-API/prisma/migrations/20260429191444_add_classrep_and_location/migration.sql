-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CLASS_REP';

-- AlterTable
ALTER TABLE "CourseEnrolment" ADD COLUMN     "isClassRep" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "locationSetAt" TIMESTAMP(3),
ADD COLUMN     "locationSetBy" TEXT,
ADD COLUMN     "openedAt" TIMESTAMP(3),
ALTER COLUMN "latitude" DROP NOT NULL,
ALTER COLUMN "longitude" DROP NOT NULL;
