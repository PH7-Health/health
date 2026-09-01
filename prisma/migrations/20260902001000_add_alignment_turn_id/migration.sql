-- Add a client-provided logical turn identity for safe retry and double-submit handling.
ALTER TABLE "AlignmentMessage" ADD COLUMN "clientTurnId" TEXT;

-- PostgreSQL permits multiple NULL values, so legacy messages remain unaffected.
CREATE UNIQUE INDEX "AlignmentMessage_sessionId_clientTurnId_key" ON "AlignmentMessage"("sessionId", "clientTurnId");
