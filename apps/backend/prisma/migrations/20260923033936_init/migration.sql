-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetData" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaintGraphRecord" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "paths" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaintGraphRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "route" JSONB NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRecord" (
    "id" TEXT NOT NULL,
    "claimType" TEXT NOT NULL,
    "claimText" TEXT NOT NULL,
    "rawDataRefs" JSONB NOT NULL,
    "verification" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "riskScore" DOUBLE PRECISION,
    "bundleHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionLog" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "nostrEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyRecord" (
    "id" TEXT NOT NULL,
    "dailyBudgetSats" INTEGER NOT NULL,
    "perTxBudgetSats" INTEGER NOT NULL,
    "scopes" TEXT[],
    "allowedMints" TEXT[],
    "allowedRelays" TEXT[],
    "allowedEsplora" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NostrEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "pubkey" TEXT NOT NULL,
    "kind" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tags" JSONB NOT NULL,
    "sig" TEXT NOT NULL,
    "relay" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NostrEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaintGraphRecord_scenarioId_idx" ON "TaintGraphRecord"("scenarioId");

-- CreateIndex
CREATE INDEX "Decision_scenarioId_idx" ON "Decision"("scenarioId");

-- CreateIndex
CREATE INDEX "Decision_evidenceId_idx" ON "Decision"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceRecord_bundleHash_key" ON "EvidenceRecord"("bundleHash");

-- CreateIndex
CREATE INDEX "ExecutionLog_scenarioId_idx" ON "ExecutionLog"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "NostrEvent_eventId_key" ON "NostrEvent"("eventId");

-- AddForeignKey
ALTER TABLE "TaintGraphRecord" ADD CONSTRAINT "TaintGraphRecord_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionLog" ADD CONSTRAINT "ExecutionLog_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
