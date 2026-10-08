import type { ReactNode } from "react";
import { type NavLink, SubTabs } from "@/components/nav-links";
import { getProjectAccess } from "@/lib/access";
import { requireContext } from "@/lib/session";

/** The project's Workers section: attendance, team, payroll and the user's own pay. */
export default async function WorkersSectionLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireContext();
  const { can } = await getProjectAccess(ctx, id);
  const base = `/projects/${id}`;
  const worksHere = (await ctx.db.projectMember.count({ where: { projectId: id, worker: { userId: ctx.user.id } } })) > 0;

  const links: NavLink[] = [
    { href: `${base}/attendance`, label: "Attendance", icon: "attendance" },
    { href: `${base}/team`, label: "Team", icon: "workers" },
    ...(can.payroll ? [{ href: `${base}/payroll`, label: "Payroll", icon: "payroll" as const }] : []),
    ...(worksHere ? [{ href: `${base}/my-pay`, label: "My pay", icon: "money" as const }] : []),
  ];

  return (
    <div className="space-y-5">
      <SubTabs links={links} />
      {children}
    </div>
  );
}
