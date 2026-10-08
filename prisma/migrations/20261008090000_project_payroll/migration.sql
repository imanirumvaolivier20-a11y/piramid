-- AlterTable
ALTER TABLE "WorkerPayment" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "WorkerPayment_projectId_workerId_idx" ON "WorkerPayment"("projectId", "workerId");

-- AddForeignKey
ALTER TABLE "WorkerPayment" ADD CONSTRAINT "WorkerPayment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Payments made before payroll moved into projects get the project the
-- worker most recently worked on.
UPDATE "WorkerPayment" p SET "projectId" = (
  SELECT a."projectId" FROM "Attendance" a
  WHERE a."workerId" = p."workerId"
  ORDER BY a."date" DESC LIMIT 1
)
WHERE p."projectId" IS NULL;
