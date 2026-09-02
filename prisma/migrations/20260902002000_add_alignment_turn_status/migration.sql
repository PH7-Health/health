-- Persist recoverable status on the user-side logical turn.
CREATE TYPE "AlignmentTurnStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'TIMED_OUT');
ALTER TABLE "AlignmentMessage" ADD COLUMN "turnStatus" "AlignmentTurnStatus" NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE "AlignmentMessage" ADD COLUMN "turnError" TEXT;
