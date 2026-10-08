import { HandCoins, Phone, UserMinus, UserPlus } from "lucide-react";
import { unassignWorker } from "@/actions/workers";
import { MenuAction, MenuLink, MoreMenu } from "@/components/menu";
import { Avatar, EmptyState, Fab } from "@/components/ui";
import { getProjectAccess } from "@/lib/access";
import { projectRoleLabels } from "@/lib/labels";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Team · Pyramid" };

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const { can, actingAccountId } = await getProjectAccess(ctx, id);

  const members = await ctx.db.projectMember.findMany({
    where: { projectId: id, worker: { active: true } },
    include: { worker: { include: { category: true } }, account: true },
    orderBy: { worker: { name: "asc" } },
  });
  const accounts = new Set(members.map((m) => m.accountId));

  return (
    <>
      {members.length === 0 ? (
        <EmptyState title="No workers on this project yet">
          {can.team ? "Tap + to add the people working on site." : "The team will appear here."}
        </EmptyState>
      ) : (
        <ul>
          {members.map((member) => {
            const own = can.team && member.accountId === actingAccountId;
            return (
              <li key={member.id} className="flex items-center gap-3 border-b border-zinc-100 py-3 last:border-0">
                <Avatar src={null} name={member.worker.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900">{member.worker.name}</p>
                  <p className="truncate text-sm text-zinc-500">
                    {[projectRoleLabels[member.role], accounts.size > 1 && member.account.name].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {(own || member.worker.phone) && (
                  <MoreMenu label={`Options for ${member.worker.name}`}>
                    {member.worker.phone && (
                      <MenuLink href={`tel:${member.worker.phone}`} icon={<Phone className="h-4 w-4" />}>
                        Call {member.worker.phone}
                      </MenuLink>
                    )}
                    {own && can.payroll && (
                      <MenuLink href={`/projects/${id}/payroll/${member.workerId}`} icon={<HandCoins className="h-4 w-4" />}>
                        Pay record
                      </MenuLink>
                    )}
                    {own && (
                      <MenuAction action={unassignWorker.bind(null, id, member.id)} danger icon={<UserMinus className="h-4 w-4" />}>
                        Remove from project
                      </MenuAction>
                    )}
                  </MoreMenu>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {can.team && <Fab href={`/projects/${id}/team/new`} label="Add worker" icon={<UserPlus className="h-6 w-6" aria-hidden />} />}
    </>
  );
}
