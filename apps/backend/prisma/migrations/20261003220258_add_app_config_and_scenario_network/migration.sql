-- AlterTable
ALTER TABLE "Scenario" ADD COLUMN     "network" TEXT;

-- CreateTable
CREATE TABLE "AppConfigRecord" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "network" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfigRecord_pkey" PRIMARY KEY ("id")
);
