-- CreateEnum
CREATE TYPE "LifeStatus" AS ENUM ('ON_TRACK', 'WATCH', 'AT_RISK', 'OFF_TRACK');

-- CreateEnum
CREATE TYPE "MetricValueType" AS ENUM ('NUMBER', 'BOOLEAN', 'SCALE_1_10', 'TEXT');

-- CreateEnum
CREATE TYPE "CompletionState" AS ENUM ('COMPLETED', 'PARTIAL', 'SKIPPED', 'MISSED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('MOST_IMPORTANT', 'CRITICAL', 'SECONDARY', 'OPTIONAL');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WATCH', 'AT_RISK', 'OFF_TRACK');

-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "ConfirmationStatus" AS ENUM ('AUTO_ACCEPTED', 'NEEDS_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "EmailMutationStatus" AS ENUM ('PROPOSED', 'APPLIED', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifeArea" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LifeArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objective" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lifeAreaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "LifeStatus" NOT NULL DEFAULT 'ON_TRACK',
    "dueDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "target" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "unit" TEXT,
    "status" "LifeStatus" NOT NULL DEFAULT 'ON_TRACK',

    CONSTRAINT "KeyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricDefinition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "valueType" "MetricValueType" NOT NULL,
    "unit" TEXT,
    "category" TEXT NOT NULL,
    "defaultTarget" DOUBLE PRECISION,
    "important" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MetricDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metricDefinitionId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "valueNumber" DOUBLE PRECISION,
    "valueText" TEXT,
    "valueBoolean" BOOLEAN,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "note" TEXT,

    CONSTRAINT "MetricEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Habit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lifeAreaId" TEXT NOT NULL,
    "objectiveId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL DEFAULT 1,
    "targetPeriod" TEXT NOT NULL DEFAULT 'day',
    "scoreWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitSchedule" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "daysOfWeek" JSONB,

    CONSTRAINT "HabitSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "state" "CompletionState" NOT NULL DEFAULT 'COMPLETED',

    CONSTRAINT "HabitCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intendedDose" DOUBLE PRECISION,
    "doseUnit" TEXT,
    "normalTime" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Supplement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplementSchedule" (
    "id" TEXT NOT NULL,
    "supplementId" TEXT NOT NULL,
    "daysOfWeek" JSONB,

    CONSTRAINT "SupplementSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplementLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "supplementId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "state" "CompletionState" NOT NULL DEFAULT 'COMPLETED',

    CONSTRAINT "SupplementLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lifeAreaId" TEXT,
    "objectiveId" TEXT,
    "title" TEXT NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'SECONDARY',
    "dueDate" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurrenceRule" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'DAILY',
    "daysOfWeek" JSONB,

    CONSTRAINT "RecurrenceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "state" "CompletionState" NOT NULL DEFAULT 'COMPLETED',

    CONSTRAINT "TaskCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "reflection" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DailyCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "score" INTEGER NOT NULL,
    "status" "LifeStatus" NOT NULL,
    "summary" TEXT NOT NULL,
    "algorithmVersion" TEXT NOT NULL DEFAULT 'v1',
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "DailyScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyScoreComponent" (
    "id" TEXT NOT NULL,
    "dailyScoreId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "expected" INTEGER NOT NULL,
    "completed" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "contribution" DOUBLE PRECISION NOT NULL,
    "details" JSONB,

    CONSTRAINT "DailyScoreComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "strongestArea" TEXT,
    "weakestArea" TEXT,
    "improved" JSONB NOT NULL,
    "deteriorated" JSONB NOT NULL,
    "neglected" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "reflection" TEXT,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "WeeklyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WATCH',
    "config" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertRuleId" TEXT,
    "localDate" DATE NOT NULL,
    "status" "LifeStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "expectedValue" TEXT NOT NULL,
    "observedValue" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minSeverity" "AlertSeverity" NOT NULL DEFAULT 'WATCH',

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" "EmailDirection" NOT NULL,
    "messageType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "sender" TEXT,
    "recipient" TEXT,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "triggerFingerprint" TEXT,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailParsedEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailMessageId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "rawValue" TEXT NOT NULL,
    "parsedValue" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "confirmationStatus" "ConfirmationStatus" NOT NULL DEFAULT 'NEEDS_CONFIRMATION',

    CONSTRAINT "EmailParsedEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMutation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailMessageId" TEXT NOT NULL,
    "targetModel" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "EmailMutationStatus" NOT NULL DEFAULT 'PROPOSED',

    CONSTRAINT "EmailMutation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "UserSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "LifeArea_userId_active_sortOrder_idx" ON "LifeArea"("userId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LifeArea_userId_key_key" ON "LifeArea"("userId", "key");

-- CreateIndex
CREATE INDEX "Objective_userId_lifeAreaId_active_idx" ON "Objective"("userId", "lifeAreaId", "active");

-- CreateIndex
CREATE INDEX "KeyResult_userId_objectiveId_idx" ON "KeyResult"("userId", "objectiveId");

-- CreateIndex
CREATE INDEX "MetricDefinition_userId_active_idx" ON "MetricDefinition"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "MetricDefinition_userId_key_key" ON "MetricDefinition"("userId", "key");

-- CreateIndex
CREATE INDEX "MetricEntry_userId_localDate_idx" ON "MetricEntry"("userId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "MetricEntry_userId_metricDefinitionId_localDate_key" ON "MetricEntry"("userId", "metricDefinitionId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "Habit_userId_key_key" ON "Habit"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "HabitCompletion_userId_habitId_localDate_key" ON "HabitCompletion"("userId", "habitId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "SupplementLog_userId_supplementId_localDate_key" ON "SupplementLog"("userId", "supplementId", "localDate");

-- CreateIndex
CREATE INDEX "Task_userId_active_idx" ON "Task"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "RecurrenceRule_taskId_key" ON "RecurrenceRule"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCompletion_userId_taskId_localDate_key" ON "TaskCompletion"("userId", "taskId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCheckIn_userId_localDate_key" ON "DailyCheckIn"("userId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyScore_userId_localDate_key" ON "DailyScore"("userId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReview_userId_weekStart_key" ON "WeeklyReview"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "AlertRule_userId_key_key" ON "AlertRule"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AlertEvent_userId_fingerprint_localDate_key" ON "AlertEvent"("userId", "fingerprint", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_channel_eventType_key" ON "NotificationPreference"("userId", "channel", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "UserSetting_userId_key_key" ON "UserSetting"("userId", "key");

-- AddForeignKey
ALTER TABLE "LifeArea" ADD CONSTRAINT "LifeArea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_lifeAreaId_fkey" FOREIGN KEY ("lifeAreaId") REFERENCES "LifeArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyResult" ADD CONSTRAINT "KeyResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyResult" ADD CONSTRAINT "KeyResult_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricDefinition" ADD CONSTRAINT "MetricDefinition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricEntry" ADD CONSTRAINT "MetricEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricEntry" ADD CONSTRAINT "MetricEntry_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_lifeAreaId_fkey" FOREIGN KEY ("lifeAreaId") REFERENCES "LifeArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitSchedule" ADD CONSTRAINT "HabitSchedule_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitCompletion" ADD CONSTRAINT "HabitCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitCompletion" ADD CONSTRAINT "HabitCompletion_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplement" ADD CONSTRAINT "Supplement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementSchedule" ADD CONSTRAINT "SupplementSchedule_supplementId_fkey" FOREIGN KEY ("supplementId") REFERENCES "Supplement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementLog" ADD CONSTRAINT "SupplementLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementLog" ADD CONSTRAINT "SupplementLog_supplementId_fkey" FOREIGN KEY ("supplementId") REFERENCES "Supplement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_lifeAreaId_fkey" FOREIGN KEY ("lifeAreaId") REFERENCES "LifeArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurrenceRule" ADD CONSTRAINT "RecurrenceRule_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCheckIn" ADD CONSTRAINT "DailyCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyScore" ADD CONSTRAINT "DailyScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyScoreComponent" ADD CONSTRAINT "DailyScoreComponent_dailyScoreId_fkey" FOREIGN KEY ("dailyScoreId") REFERENCES "DailyScore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "AlertRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailParsedEntry" ADD CONSTRAINT "EmailParsedEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailParsedEntry" ADD CONSTRAINT "EmailParsedEntry_emailMessageId_fkey" FOREIGN KEY ("emailMessageId") REFERENCES "EmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMutation" ADD CONSTRAINT "EmailMutation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMutation" ADD CONSTRAINT "EmailMutation_emailMessageId_fkey" FOREIGN KEY ("emailMessageId") REFERENCES "EmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSetting" ADD CONSTRAINT "UserSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
