-- Make the Life OS objective function and operating assumptions user-configurable.
ALTER TYPE "MetricValueType" ADD VALUE IF NOT EXISTS 'INTEGER';
ALTER TYPE "MetricValueType" ADD VALUE IF NOT EXISTS 'DECIMAL';
ALTER TYPE "MetricValueType" ADD VALUE IF NOT EXISTS 'DURATION';
ALTER TYPE "MetricValueType" ADD VALUE IF NOT EXISTS 'SELECT';

ALTER TABLE "Objective" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "KeyResult"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "metricDefinitionId" TEXT,
  ADD COLUMN "baseline" DOUBLE PRECISION,
  ADD COLUMN "targetDirection" TEXT NOT NULL DEFAULT 'INCREASE',
  ADD COLUMN "currentValueSource" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN "dueDate" TIMESTAMP(3),
  ADD COLUMN "qualitative" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "MetricDefinition"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "targetMin" DOUBLE PRECISION,
  ADD COLUMN "targetMax" DOUBLE PRECISION,
  ADD COLUMN "targetDirection" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "frequency" TEXT NOT NULL DEFAULT 'DAILY',
  ADD COLUMN "decimalPrecision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "showInCheckIn" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showInDashboard" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "useInDrift" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "useInScore" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "selectOptions" JSONB;

ALTER TABLE "Habit"
  ADD COLUMN "frequency" TEXT NOT NULL DEFAULT 'DAILY',
  ADD COLUMN "showToday" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "affectsScore" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "participatesInDrift" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notes" TEXT;

ALTER TABLE "Supplement"
  ADD COLUMN "frequency" TEXT NOT NULL DEFAULT 'DAILY',
  ADD COLUMN "startDate" DATE,
  ADD COLUMN "endDate" DATE,
  ADD COLUMN "notes" TEXT;

ALTER TABLE "SupplementLog" ADD COLUMN "configurationSnapshot" JSONB;

ALTER TABLE "Task"
  ADD COLUMN "showToday" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "scoreRelevant" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "targetFrequency" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "KeyResult" ADD CONSTRAINT "KeyResult_metricDefinitionId_fkey"
  FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
