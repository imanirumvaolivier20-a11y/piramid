import { redirect } from "next/navigation";
import { addExpense } from "@/actions/expenses";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, inputClass } from "@/components/ui";
import { getProjectAccess } from "@/lib/access";
import { toDateInput } from "@/lib/format";
import { expenseCategoryLabels } from "@/lib/labels";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Log an expense · Pyramid" };

export default async function NewExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const { project, can } = await getProjectAccess(ctx, id);
  if (!can.expense) redirect(`/projects/${id}/expenses`);

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="mb-4 text-lg font-semibold">Log an expense</h2>
      <ActionForm action={addExpense.bind(null, id)} className="space-y-4">
        <Field label={`Amount (${project.account.currency})`}>
          <input type="number" name="amount" required min={0} step="any" inputMode="decimal" autoFocus className={`${inputClass} text-2xl`} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-zinc-700">What was it for?</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(expenseCategoryLabels).map(([value, label], index) => (
              <label key={value} className="cursor-pointer">
                <input type="radio" name="category" value={value} defaultChecked={index === 0} className="peer sr-only" />
                <span className="block rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 peer-checked:bg-zinc-900 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Note">
          <input name="note" placeholder="e.g. Truck hire for sand" className={inputClass} />
        </Field>
        <Field label="Date">
          <input type="date" name="date" required defaultValue={toDateInput(new Date())} className={inputClass} />
        </Field>
        <Field label="Receipt photo (optional)">
          <input type="file" name="receipt" accept="image/*" className="block w-full text-sm" />
        </Field>
        <SubmitButton className="w-full">Save expense</SubmitButton>
      </ActionForm>
    </div>
  );
}
