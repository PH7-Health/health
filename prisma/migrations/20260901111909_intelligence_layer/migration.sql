-- CreateEnum
CREATE TYPE "PathwayStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TrajectoryStatus" AS ENUM ('AHEAD', 'ON_TRACK', 'WATCH', 'BEHIND', 'STALLED', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "IntelligenceConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('TREND', 'PROGRESS', 'STALL', 'COMPLIANCE', 'IMBALANCE', 'NEGLECT', 'MILESTONE', 'DATA_QUALITY');

-- CreateTable
CREATE TABLE "GoalPathway" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "currentDescription" TEXT NOT NULL,
    "desiredDescription" TEXT NOT NULL,
    "constraints" TEXT,
    "preferences" TEXT,
    "baselineValue" DOUBLE PRECISION,
    "targetValue" DOUBLE PRECISION,
    "unit" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'INCREASE',
    "baselineDate" DATE,
    "desiredDate" DATE,
    "status" "PathwayStatus" NOT NULL DEFAULT 'DRAFT',
    "trajectoryStatus" "TrajectoryStatus" NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    "confidence" "IntelligenceConfidence" NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    "limiterTitle" TEXT,
    "limiterExplanation" TEXT,
    "limiterConfidence" "IntelligenceConfidence" NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    "lastRecalculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalPathway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetValue" DOUBLE PRECISION,
    "unit" TEXT,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "targetDate" DATE,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathwayAction" (
    "id" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "taskId" TEXT,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "expectedImpact" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PathwayAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathwayRevision" (
    "id" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PathwayRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrajectorySnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "progressPercent" DOUBLE PRECISION,
    "velocity" DOUBLE PRECISION,
    "estimateLowDate" DATE,
    "estimateHighDate" DATE,
    "status" "TrajectoryStatus" NOT NULL,
    "confidence" "IntelligenceConfidence" NOT NULL,
    "basis" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrajectorySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathwayId" TEXT,
    "type" "InsightType" NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "confidence" "IntelligenceConfidence" NOT NULL,
    "dataWindowStart" DATE,
    "dataWindowEnd" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathwayId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "expectedImpact" TEXT,
    "confidence" "IntelligenceConfidence" NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIProposal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathwayId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "schemaVersion" TEXT NOT NULL,
    "confidence" "IntelligenceConfidence" NOT NULL,
    "dataWindow" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AIProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIExecution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "operation" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "inputWindow" JSONB NOT NULL,
    "output" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoalPathway_objectiveId_key" ON "GoalPathway"("objectiveId");

-- CreateIndex
CREATE INDEX "GoalPathway_userId_status_idx" ON "GoalPathway"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_pathwayId_sequence_key" ON "Milestone"("pathwayId", "sequence");

-- CreateIndex
CREATE INDEX "PathwayAction_pathwayId_active_priority_idx" ON "PathwayAction"("pathwayId", "active", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "TrajectorySnapshot_pathwayId_localDate_key" ON "TrajectorySnapshot"("pathwayId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "Insight_userId_fingerprint_key" ON "Insight"("userId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_userId_fingerprint_key" ON "Recommendation"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "AIProposal_userId_status_idx" ON "AIProposal"("userId", "status");

-- AddForeignKey
ALTER TABLE "GoalPathway" ADD CONSTRAINT "GoalPathway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalPathway" ADD CONSTRAINT "GoalPathway_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "GoalPathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayAction" ADD CONSTRAINT "PathwayAction_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "GoalPathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayAction" ADD CONSTRAINT "PathwayAction_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayRevision" ADD CONSTRAINT "PathwayRevision_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "GoalPathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrajectorySnapshot" ADD CONSTRAINT "TrajectorySnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrajectorySnapshot" ADD CONSTRAINT "TrajectorySnapshot_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "GoalPathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "GoalPathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "GoalPathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIProposal" ADD CONSTRAINT "AIProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIProposal" ADD CONSTRAINT "AIProposal_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "GoalPathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIExecution" ADD CONSTRAINT "AIExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
