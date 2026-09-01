-- CreateEnum
CREATE TYPE "AlignmentSessionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AlignmentMessageRole" AS ENUM ('USER', 'ASSISTANT', 'CORRECTION');

-- CreateEnum
CREATE TYPE "AlignmentSource" AS ENUM ('STATED', 'INFERRED', 'OBSERVED');

-- CreateTable
CREATE TABLE "AlignmentSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lifeAreaId" TEXT NOT NULL,
    "status" "AlignmentSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlignmentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlignmentMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "AlignmentMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "schemaVersion" TEXT,
    "validation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlignmentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlignmentUnderstanding" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" "AlignmentSource" NOT NULL,
    "confidence" "IntelligenceConfidence" NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    "rationale" TEXT,
    "evidence" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "correctedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlignmentUnderstanding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlignmentSession_userId_lifeAreaId_status_idx" ON "AlignmentSession"("userId", "lifeAreaId", "status");

-- CreateIndex
CREATE INDEX "AlignmentMessage_sessionId_createdAt_idx" ON "AlignmentMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AlignmentUnderstanding_sessionId_category_active_idx" ON "AlignmentUnderstanding"("sessionId", "category", "active");

-- AddForeignKey
ALTER TABLE "AlignmentSession" ADD CONSTRAINT "AlignmentSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlignmentSession" ADD CONSTRAINT "AlignmentSession_lifeAreaId_fkey" FOREIGN KEY ("lifeAreaId") REFERENCES "LifeArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlignmentMessage" ADD CONSTRAINT "AlignmentMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AlignmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlignmentUnderstanding" ADD CONSTRAINT "AlignmentUnderstanding_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AlignmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
