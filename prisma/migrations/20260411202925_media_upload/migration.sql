/*
  Warnings:

  - You are about to drop the column `club_id` on the `coaches` table. All the data in the column will be lost.
  - You are about to drop the column `club_id` on the `players` table. All the data in the column will be lost.
  - You are about to drop the column `request_status` on the `season_club_coaches` table. All the data in the column will be lost.
  - You are about to drop the column `player_role` on the `season_club_players` table. All the data in the column will be lost.
  - You are about to drop the column `request_status` on the `season_club_players` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "coaches" DROP CONSTRAINT "coaches_club_id_fkey";

-- DropForeignKey
ALTER TABLE "players" DROP CONSTRAINT "players_club_id_fkey";

-- AlterTable
ALTER TABLE "coaches" DROP COLUMN "club_id",
ADD COLUMN     "clubId" UUID;

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "liveStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "players" DROP COLUMN "club_id",
ADD COLUMN     "clubId" UUID;

-- AlterTable
ALTER TABLE "season_club_coaches" DROP COLUMN "request_status",
ADD COLUMN     "requestStatus" TEXT NOT NULL DEFAULT 'approved';

-- AlterTable
ALTER TABLE "season_club_players" DROP COLUMN "player_role",
DROP COLUMN "request_status",
ADD COLUMN     "playerRole" TEXT,
ADD COLUMN     "requestStatus" TEXT NOT NULL DEFAULT 'approved';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "photoUrl" TEXT;

-- CreateTable
CREATE TABLE "match_meas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "matchId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_meas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clubId" UUID NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stadium_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stadiumId" UUID NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stadium_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "playerId" UUID NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "coachId" UUID NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "matchId" UUID NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "match_meas_matchId_userId_key" ON "match_meas"("matchId", "userId");

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_meas" ADD CONSTRAINT "match_meas_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_meas" ADD CONSTRAINT "match_meas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_images" ADD CONSTRAINT "club_images_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stadium_images" ADD CONSTRAINT "stadium_images_stadiumId_fkey" FOREIGN KEY ("stadiumId") REFERENCES "stadiums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_images" ADD CONSTRAINT "player_images_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_images" ADD CONSTRAINT "coach_images_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_media" ADD CONSTRAINT "match_media_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
