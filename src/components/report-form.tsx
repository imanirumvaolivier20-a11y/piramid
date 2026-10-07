"use client";

import { useActionState, useState } from "react";
import { FormError, SubmitButton } from "@/components/forms";
import { PhotoPicker } from "@/components/photo-picker";
import { Field, buttonClass, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Category = { id: string; name: string; dailyRate: number | null };
type Material = { name: string; quantity: string; unit: string };
type Wage = { categoryId: string | null; categoryName: string; workers: string; amount: string };

const compactInput = inputClass.replace("px-3", "px-2");

export function ReportForm({
  action,
  categories,
  currency,
  today,
  materialNames = [],
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  categories: Category[];
  currency: string;
  today: string;
  /** Material names already on the project, suggested so the stock totals line up. */
  materialNames?: string[];
}) {
  const [state, formAction] = useActionState(action, {});

  // Controlled fields, so nothing typed is lost if the server rejects the form.
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [workersCount, setWorkersCount] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [wages, setWages] = useState<Wage[]>(
    categories.map((c) => ({ categoryId: c.id, categoryName: c.name, workers: "", amount: "" })),
  );

  const usedWages = wages.filter((w) => Number(w.workers) > 0 || Number(w.amount) > 0);
  const wageTotal = usedWages.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
  const wageWorkers = usedWages.reduce((sum, w) => sum + (Number(w.workers) || 0), 0);

  function updateMaterial(index: number, patch: Partial<Material>) {
    setMaterials((list) => list.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function updateWage(index: number, patch: Partial<Wage>) {
    setWages((list) =>
      list.map((w, i) => {
        if (i !== index) return w;
        const next = { ...w, ...patch };
        // Suggest workers × daily rate until the user types their own amount.
        const rate = categories.find((c) => c.id === w.categoryId)?.dailyRate;
        if (patch.workers !== undefined && rate) next.amount = String(rate * (Number(patch.workers) || 0));
        return next;
      }),
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <datalist id="report-material-names">
        {materialNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <input type="hidden" name="materials" value={JSON.stringify(materials)} />
      <input type="hidden" name="wages" value={JSON.stringify(usedWages)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date of work">
          <input type="date" name="date" required max={today} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
        <Field label="People on site" hint={wageWorkers > 0 ? `${wageWorkers} counted in wages below.` : undefined}>
          <input
            type="number"
            name="workersCount"
            min={0}
            inputMode="numeric"
            placeholder={String(wageWorkers)}
            value={workersCount}
            onChange={(e) => setWorkersCount(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Work completed">
        <textarea
          name="description"
          required
          rows={4}
          placeholder="What was done today?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-zinc-700">Photos of finished work</legend>
        <PhotoPicker name="photos" />
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-zinc-700">Materials used</legend>
        <div className="space-y-2">
          {materials.map((material, index) => (
            <div key={index} className="grid grid-cols-[1fr_5rem_5rem_2.75rem] gap-2">
              <input
                aria-label="Material"
                list="report-material-names"
                placeholder="Cement"
                value={material.name}
                onChange={(e) => updateMaterial(index, { name: e.target.value })}
                className={compactInput}
              />
              <input
                aria-label="Quantity"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                placeholder="Qty"
                value={material.quantity}
                onChange={(e) => updateMaterial(index, { quantity: e.target.value })}
                className={compactInput}
              />
              <input
                aria-label="Unit"
                placeholder="bags"
                value={material.unit}
                onChange={(e) => updateMaterial(index, { unit: e.target.value })}
                className={compactInput}
              />
              <button
                type="button"
                onClick={() => setMaterials((list) => list.filter((_, i) => i !== index))}
                className="rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                aria-label="Remove material"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setMaterials((list) => [...list, { name: "", quantity: "", unit: "" }])}
          className={`${buttonClass.secondary} mt-2`}
        >
          + Add material
        </button>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-zinc-700">Wages for the day, by category ({currency})</legend>
        <p className="mb-2 text-xs text-zinc-500">
          If you record attendance for this day, wages are calculated from it and these lines are not counted twice.
        </p>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_5rem_7rem] gap-2 text-xs font-medium text-zinc-500">
            <span>Category</span>
            <span>Workers</span>
            <span>Total paid</span>
          </div>
          {wages.map((wage, index) => (
            <div key={index} className="grid grid-cols-[1fr_5rem_7rem] items-center gap-2">
              {wage.categoryId ? (
                <span className="truncate text-sm text-zinc-800">{wage.categoryName}</span>
              ) : (
                <input
                  aria-label="Category"
                  placeholder="Category"
                  value={wage.categoryName}
                  onChange={(e) => updateWage(index, { categoryName: e.target.value })}
                  className={compactInput}
                />
              )}
              <input
                aria-label={`Workers: ${wage.categoryName}`}
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="0"
                value={wage.workers}
                onChange={(e) => updateWage(index, { workers: e.target.value })}
                className={compactInput}
              />
              <input
                aria-label={`Total paid: ${wage.categoryName}`}
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                placeholder="0"
                value={wage.amount}
                onChange={(e) => updateWage(index, { amount: e.target.value })}
                className={compactInput}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setWages((list) => [...list, { categoryId: null, categoryName: "", workers: "", amount: "" }])}
            className={buttonClass.secondary}
          >
            + Other category
          </button>
          <p className="text-sm text-zinc-700">
            Total wages: <strong>{wageTotal.toLocaleString("en")} {currency}</strong>
          </p>
        </div>
      </fieldset>

      <FormError message={state.error} />
      <SubmitButton className="w-full sm:w-auto">Submit daily report</SubmitButton>
    </form>
  );
}
