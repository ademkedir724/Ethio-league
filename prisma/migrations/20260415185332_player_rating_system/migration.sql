-- CreateTable
CREATE TABLE "entity_ratings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rating_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "goalWeight" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "assistWeight" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "yellowCardPenalty" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "redCardPenalty" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "appearanceWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "cleanSheetWeight" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "winRateWeight" DOUBLE PRECISION NOT NULL DEFAULT 40.0,
    "goalDiffNormMax" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "pointsPerMatchNormMax" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "seasonDecayRate" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "seasonMinWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "maxSeasonsNorm" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "leagueGoalsNormMax" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rating_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entity_ratings_entityType_entityId_key" ON "entity_ratings"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "rating_snapshots_entityType_entityId_snapshotAt_idx" ON "rating_snapshots"("entityType", "entityId", "snapshotAt" DESC);
