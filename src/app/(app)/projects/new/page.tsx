import { redirect } from "next/navigation";
import { createProject } from "@/actions/projects";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, PageHeader, inputClass } from "@/components/ui";
import { toDateInput } from "@/lib/format";
import { projectStatusLabels } from "@/lib/labels";
import { requireContext } from "@/lib/session";

export const metadata = { title: "New project · Pyramid" };

export default async function NewProjectPage() {
  const ctx = await requireContext();
  if (!ctx.account.type.canOwnProjects || !ctx.isManager) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="New project" subtitle={`Owned by ${ctx.account.name}`} />
      <Card>
        <ActionForm action={createProject} className="space-y-4">
          <Field label="Project name">
            <input name="name" required placeholder="Family house in Kicukiro" className={inputClass} />
          </Field>
          <Field label="Location">
            <input name="location" placeholder="District, sector or address" className={inputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date">
              <input type="date" name="startDate" defaultValue={toDateInput(new Date())} className={inputClass} />
            </Field>
            <Field label="Status">
              <select name="status" defaultValue="ACTIVE" className={inputClass}>
                {Object.entries(projectStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea name="description" rows={3} placeholder="What is being built?" className={inputClass} />
          </Field>
          <SubmitButton className="w-full sm:w-auto">Create project</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
