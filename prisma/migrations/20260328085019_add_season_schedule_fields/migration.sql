/*
  Warnings:

  - You are about to drop the column `ageCategory` on the `seasons` table. All the data in the column will be lost.
  - You are about to drop the column `divisionLevel` on the `seasons` table. All the data in the column will be lost.
  - You are about to drop the column `genderCategory` on the `seasons` table. All the data in the column will be lost.
  - You are about to drop the column `leagueName` on the `seasons` table. All the data in the column will be lost.
  - You are about to drop the column `leagueTypeId` on the `seasons` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `seasons` table. All the data in the column will be lost.
  - You are about to drop the `referee_leagues` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `leagueId` to the `seasons` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "referee_leagues" DROP CONSTRAINT "referee_leagues_refereeId_fkey";

-- DropForeignKey
ALTER TABLE "referee_leagues" DROP CONSTRAINT "referee_leagues_seasonId_fkey";

-- DropForeignKey
ALTER TABLE "seasons" DROP CONSTRAINT "seasons_leagueTypeId_fkey";

-- DropForeignKey
ALTER TABLE "seasons" DROP CONSTRAINT "seasons_organizationId_fkey";

-- AlterTable
ALTER TABLE "seasons" DROP COLUMN "ageCategory",
DROP COLUMN "divisionLevel",
DROP COLUMN "genderCategory",
DROP COLUMN "leagueName",
DROP COLUMN "leagueTypeId",
DROP COLUMN "organizationId",
ADD COLUMN     "daysBetweenRounds" INTEGER,
ADD COLUMN     "leagueId" UUID NOT NULL,
ADD COLUMN     "requiredClubs" INTEGER,
ADD COLUMN     "roundRobinType" TEXT DEFAULT 'double';

-- AlterTable
ALTER TABLE "user_role_scopes" ADD COLUMN     "leagueId" UUID;

-- DropTable
DROP TABLE "referee_leagues";

-- CreateTable
CREATE TABLE "leagues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "leagueTypeId" INTEGER,
    "genderCategory" TEXT,
    "ageCategory" TEXT,
    "divisionLevel" INTEGER,
    "logoUrl" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_referees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "refereeId" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "roleLevel" TEXT,
    "approvedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "season_referees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leagues_organizationId_name_key" ON "leagues"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "season_referees_refereeId_seasonId_key" ON "season_referees"("refereeId", "seasonId");

-- AddForeignKey
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_leagueTypeId_fkey" FOREIGN KEY ("leagueTypeId") REFERENCES "league_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_referees" ADD CONSTRAINT "season_referees_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "referees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_referees" ADD CONSTRAINT "season_referees_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_scopes" ADD CONSTRAINT "user_role_scopes_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
