-- CreateEnum
CREATE TYPE "MaterialRequestStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "ExpenseCategory" ADD VALUE 'SALARIES';

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "logoKey" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "materialRequestId" TEXT;

-- CreateTable
CREATE TABLE "MaterialRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "status" "MaterialRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "note" TEXT,
    "neededBy" DATE,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "forwardedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "receivedById" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receivedNote" TEXT,

    CONSTRAINT "MaterialRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "details" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(14,2),
    "receivedQuantity" DECIMAL(14,3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MaterialRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialRequest_toAccountId_status_idx" ON "MaterialRequest"("toAccountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialRequest_projectId_number_key" ON "MaterialRequest"("projectId", "number");

-- CreateIndex
CREATE INDEX "MaterialRequestItem_requestId_idx" ON "MaterialRequestItem"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_logoKey_key" ON "Account"("logoKey");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_materialRequestId_key" ON "Expense"("materialRequestId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "MaterialRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequestItem" ADD CONSTRAINT "MaterialRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ───────────── Row-level security for material requests ─────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON "MaterialRequest", "MaterialRequestItem" TO piramid_app;

CREATE FUNCTION app_can_access_material_request(rid text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "MaterialRequest" r
    WHERE r."id" = rid AND app_can_access_project(r."projectId")
  )
$$;

ALTER TABLE "MaterialRequest"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaterialRequestItem" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "MaterialRequest" TO piramid_app
  USING (app_can_access_project("projectId"));

CREATE POLICY tenant_isolation ON "MaterialRequestItem" TO piramid_app
  USING (app_can_access_material_request("requestId"));

-- ───────────── Pyramid only uses Rwandan francs ─────────────
UPDATE "Account" SET "currency" = 'RWF' WHERE "currency" <> 'RWF';