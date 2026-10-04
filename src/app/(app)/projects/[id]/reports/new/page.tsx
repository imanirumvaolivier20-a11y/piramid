import { redirect } from "next/navigation";
import { createDailyReport } from "@/actions/reports";
import { ReportForm } from "@/components/report-form";
import { Card } from "@/components/ui";
import { getProjectAccess } from "@/lib/access";
import { toDateInput } from "@/lib/format";
import { requireContext } from "@/lib/session";

export const metadata = { title: "New daily report · Pyramid" };

export default async function NewReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, id);
  if (!access.can.report) redirect(`/projects/${id}`);

  const categories = await ctx.db.workerCategory.findMany({
    where: { accountId: access.actingAccountId },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-3 text-lg font-semibold">New daily report</h2>
      <Card>
        <ReportForm
          action={createDailyReport.bind(null, id)}
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            dailyRate: c.dailyRate ? Number(c.dailyRate) : null,
          }))}
          currency={access.project.account.currency}
          today={toDateInput(new Date())}
        />
      </Card>
    </div>
  );
}
