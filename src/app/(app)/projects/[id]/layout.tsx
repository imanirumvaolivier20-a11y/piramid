import { ArrowLeft, Building2, CalendarCheck, Package, PencilLine, UserMinus, UserPlus, Users, X } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { endContract, respondToHire } from "@/actions/contracts";
import { SubmitButton } from "@/components/forms";
import { MenuAction, MenuDivider, MenuLink, MoreMenu } from "@/components/menu";
import { type NavLink, ProjectTabs } from "@/components/nav-links";
import { ProjectMark } from "@/components/ui";
import { getProjectAccess } from "@/lib/access";
import { formatMoney } from "@/lib/format";
import { engagementModels } from "@/lib/labels";
import { requireContext } from "@/lib/session";

const menuIcon = "h-4 w-4";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireContext();
  const { project, contract, level, can } = await getProjectAccess(ctx, id);
  const base = `/projects/${id}`;
  const workersHome = can.attendance ? `${base}/attendance` : `${base}/team`;

  const tabs: NavLink[] = [
    { href: base, label: "Home", icon: "home", exact: true },
    { href: `${base}/activity`, label: "Activity", icon: "activity", also: [`${base}/reports`] },
    { href: `${base}/materials`, label: "Materials", icon: "materials" },
    {
      href: workersHome,
      label: "Workers",
      icon: "workers",
      also: [`${base}/attendance`, `${base}/team`, `${base}/payroll`, `${base}/my-pay`],
    },
    ...(can.viewMoney ? [{ href: `${base}/expenses`, label: "Money", icon: "money" as const }] : []),
  ];

  const subtitle = contract
    ? contract.status === "PENDING"
      ? level === "OWNER"
        ? `Waiting for ${contract.contractor.name} to accept`
        : `Hire request from ${project.account.name}`
      : level === "OWNER"
        ? `Managed by ${contract.contractor.name}`
        : `Owner: ${project.account.name}`
    : (project.location ?? `Owner: ${project.account.name}`);

  return (
    <>
      {/* The project's own bar, like the header of a chat. */}
      <div className="sticky top-0 z-20 -mx-4 -mt-4 mb-4 flex items-center gap-2 border-b border-zinc-100 bg-white/95 px-2 py-2 backdrop-blur sm:top-14 sm:mt-0 sm:rounded-b-2xl">
        <Link href="/dashboard" aria-label="Back to projects" className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <ProjectMark name={project.name} />
        <div className="min-w-0 flex-1 px-1">
          <h1 className="truncate font-semibold text-zinc-900">{project.name}</h1>
          <p className="truncate text-sm text-zinc-500">{subtitle}</p>
        </div>
        <MoreMenu label="Project options">
          {can.report && (
            <MenuLink href={`${base}/reports/new`} icon={<PencilLine className={menuIcon} />}>
              New daily report
            </MenuLink>
          )}
          {can.requestMaterials && (
            <MenuLink href={`${base}/materials/new`} icon={<Package className={menuIcon} />}>
              Request materials
            </MenuLink>
          )}
          {can.attendance && (
            <MenuLink href={`${base}/attendance`} icon={<CalendarCheck className={menuIcon} />}>
              Attendance
            </MenuLink>
          )}
          <MenuLink href={`${base}/team`} icon={<Users className={menuIcon} />}>
            Team
          </MenuLink>
          {contract && contract.status === "ACTIVE" && (
            <MenuLink href={`/accounts/${contract.contractor.username}`} icon={<Building2 className={menuIcon} />}>
              {level === "OWNER" ? `About ${contract.contractor.name}` : "Hire details"}
            </MenuLink>
          )}
          {(can.hire || can.endContract) && <MenuDivider />}
          {can.hire && (
            <MenuLink href={`${base}/hire`} icon={<UserPlus className={menuIcon} />}>
              Hire engineer or company
            </MenuLink>
          )}
          {can.endContract && contract && (
            <MenuAction
              action={endContract.bind(null, id)}
              danger
              icon={contract.status === "PENDING" ? <X className={menuIcon} /> : <UserMinus className={menuIcon} />}
            >
              {contract.status === "PENDING" ? "Cancel hire request" : `End hire of ${contract.contractor.name}`}
            </MenuAction>
          )}
        </MoreMenu>
      </div>

      {/* A hire request is the one thing that must be answered before anything else. */}
      {can.respond && contract && (
        <div className="mb-4 rounded-2xl bg-amber-50 p-4">
          <p className="font-medium text-zinc-900">{project.account.name} wants to hire you for this project</p>
          <p className="mt-1 text-sm text-zinc-700">
            {engagementModels[contract.engagementModel].label}
            {contract.agreedBudget && ` · Budget ${formatMoney(contract.agreedBudget, project.account.currency)}`}
          </p>
          {contract.note && <p className="mt-1 text-sm text-zinc-700">“{contract.note}”</p>}
          <div className="mt-3 flex gap-2">
            <form action={respondToHire.bind(null, id, true)} className="flex-1 sm:flex-none">
              <SubmitButton className="w-full">Accept</SubmitButton>
            </form>
            <form action={respondToHire.bind(null, id, false)} className="flex-1 sm:flex-none">
              <SubmitButton variant="secondary" className="w-full">
                Decline
              </SubmitButton>
            </form>
          </div>
        </div>
      )}

      <ProjectTabs links={tabs} />
      <div className="pt-4 sm:pt-6">{children}</div>
    </>
  );
}
