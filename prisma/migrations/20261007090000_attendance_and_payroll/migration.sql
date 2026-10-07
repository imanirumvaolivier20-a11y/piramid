-- CreateEnum
CREATE TYPE "PayCycle" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'HALF_DAY', 'ABSENT');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "payCycle" "PayCycle" NOT NULL DEFAULT 'WEEKLY';

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "dailyRate" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerPayment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "periodStart" DATE,
    "periodEnd" DATE,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attendance_projectId_date_idx" ON "Attendance"("projectId", "date");

-- CreateIndex
CREATE INDEX "Attendance_accountId_date_idx" ON "Attendance"("accountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_workerId_date_key" ON "Attendance"("workerId", "date");

-- CreateIndex
CREATE INDEX "WorkerPayment_workerId_date_idx" ON "WorkerPayment"("workerId", "date");

-- CreateIndex
CREATE INDEX "WorkerPayment_accountId_date_idx" ON "WorkerPayment"("accountId", "date");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerPayment" ADD CONSTRAINT "WorkerPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerPayment" ADD CONSTRAINT "WorkerPayment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerPayment" ADD CONSTRAINT "WorkerPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ───────────── Row-level security for attendance and pay ─────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON "Attendance", "WorkerPayment" TO piramid_app;

-- True when the worker row is the signed-in user's own roster entry.
CREATE FUNCTION app_is_own_worker(wid text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "Worker" w WHERE w."id" = wid AND w."userId" = app_user_id())
$$;

ALTER TABLE "Attendance"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkerPayment" ENABLE ROW LEVEL SECURITY;

-- Everyone on the project sees its attendance; workers also see their own
-- attendance on projects they have left.
CREATE POLICY tenant_isolation ON "Attendance" TO piramid_app
  USING (app_can_access_project("projectId") OR app_is_own_worker("workerId"))
  WITH CHECK (app_can_access_project("projectId"));

-- Accounts the user owns or administers (not plain members).
CREATE FUNCTION app_managed_account_ids() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg("accountId"), '{}')
  FROM "Membership"
  WHERE "userId" = app_user_id() AND "role" IN ('OWNER', 'ADMIN')
$$;

-- Payments are private to the paying account's managers and the worker paid.
CREATE POLICY tenant_isolation ON "WorkerPayment" TO piramid_app
  USING ("accountId" = ANY (app_managed_account_ids()) OR app_is_own_worker("workerId"))
  WITH CHECK ("accountId" = ANY (app_managed_account_ids()));

-- Workers can always see their own roster entries, for their pay history.
DROP POLICY tenant_isolation ON "Worker";
CREATE POLICY tenant_isolation ON "Worker" TO piramid_app
  USING ("accountId" = ANY (app_account_ids()) OR app_can_see_worker("id") OR "userId" = app_user_id())
  WITH CHECK ("accountId" = ANY (app_account_ids()));
