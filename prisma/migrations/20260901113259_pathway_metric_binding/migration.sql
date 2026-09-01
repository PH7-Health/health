-- CreateTable
CREATE TABLE "PathwayMetric" (
    "id" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "metricDefinitionId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PRIMARY',
    "rationale" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "PathwayMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PathwayMetric_metricDefinitionId_active_idx" ON "PathwayMetric"("metricDefinitionId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PathwayMetric_pathwayId_metricDefinitionId_key" ON "PathwayMetric"("pathwayId", "metricDefinitionId");

-- AddForeignKey
ALTER TABLE "PathwayMetric" ADD CONSTRAINT "PathwayMetric_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "GoalPathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayMetric" ADD CONSTRAINT "PathwayMetric_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayMetric" ADD CONSTRAINT "PathwayMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
