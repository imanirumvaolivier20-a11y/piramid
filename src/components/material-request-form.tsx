"use client";

import { useActionState, useState } from "react";
import { FormError, SubmitButton } from "@/components/forms";
import { Field, buttonClass, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Recipient = { accountId: string; name: string; label: string };
type Item = { name: string; details: string; quantity: string; unit: string; unitPrice: string };

const emptyItem: Item = { name: "", details: "", quantity: "", unit: "", unitPrice: "" };

export function MaterialRequestForm({
  action,
  recipients,
  defaultRecipient,
  showPrices,
  currency,
  knownMaterials,
  today,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  recipients: Recipient[];
  defaultRecipient: string;
  showPrices: boolean;
  currency: string;
  /** Names and units already used on the project, suggested so stock totals line up. */
  knownMaterials: { name: string; unit: string }[];
  today: string;
}) {
  const [state, formAction] = useActionState(action, {});

  // Controlled fields, so nothing typed is lost if the server rejects the form.
  const [toAccountId, setToAccountId] = useState(defaultRecipient);
  const [neededBy, setNeededBy] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<Item[]>([{ ...emptyItem }]);

  const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  const names = [...new Set(knownMaterials.map((m) => m.name))];
  const units = [...new Set(["bags", "pcs", "m³", "m²", "m", "kg", "tons", "litres", "trips", ...knownMaterials.map((m) => m.unit)])];

  function update(index: number, patch: Partial<Item>) {
    setItems((list) =>
      list.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        // Picking a known material fills in the unit it was recorded with.
        if (patch.name !== undefined && !item.unit) {
          const known = knownMaterials.find((m) => m.name.toLowerCase() === patch.name!.trim().toLowerCase());
          if (known) next.unit = known.unit;
        }
        return next;
      }),
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <datalist id="material-names">
        {names.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <datalist id="material-units">
        {units.map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-zinc-700">Send this request to</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {recipients.map((recipient) => (
            <label
              key={recipient.accountId}
              className="flex cursor-pointer gap-3 rounded-xl border border-zinc-200 p-3 has-[:checked]:border-amber-500 has-[:checked]:ring-2 has-[:checked]:ring-amber-500/30"
            >
              <input
                type="radio"
                name="toAccountId"
                value={recipient.accountId}
                checked={toAccountId === recipient.accountId}
                onChange={() => setToAccountId(recipient.accountId)}
                className="mt-1 accent-amber-500"
              />
              <span>
                <span className="block text-sm font-semibold text-zinc-900">{recipient.name}</span>
                <span className="block text-sm text-zinc-600">{recipient.label}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-zinc-700">Materials needed</legend>
        <ol className="space-y-3">
          {items.map((item, index) => (
            <li key={index} className="rounded-xl border border-zinc-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Item {index + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems((list) => list.filter((_, i) => i !== index))}
                    className="text-sm text-red-700 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_6rem_7rem]">
                <Field label="Material">
                  <input
                    list="material-names"
                    placeholder="Cement"
                    value={item.name}
                    onChange={(e) => update(index, { name: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Quantity">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={item.quantity}
                    onChange={(e) => update(index, { quantity: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Unit">
                  <input
                    list="material-units"
                    placeholder="bags"
                    value={item.unit}
                    onChange={(e) => update(index, { unit: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Product description (optional)" className="mt-3">
                <textarea
                  rows={2}
                  placeholder="Brand, type, size, grade, colour… e.g. CIMERWA 42.5R, 50 kg bags"
                  value={item.details}
                  onChange={(e) => update(index, { details: e.target.value })}
                  className={inputClass}
                />
              </Field>
              {showPrices && (
                <Field label={`Estimated price per unit (${currency}, optional)`} className="mt-3 sm:max-w-xs">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={item.unitPrice}
                    onChange={(e) => update(index, { unitPrice: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              )}
            </li>
          ))}
        </ol>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setItems((list) => [...list, { ...emptyItem }])} className={buttonClass.secondary}>
            + Add another material
          </button>
          {showPrices && total > 0 && (
            <p className="text-sm text-zinc-700">
              Estimated total: <strong>{total.toLocaleString("en")} {currency}</strong>
            </p>
          )}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Needed by (optional)">
          <input
            type="date"
            name="neededBy"
            min={today}
            value={neededBy}
            onChange={(e) => setNeededBy(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Note (optional)">
        <textarea
          name="note"
          rows={3}
          placeholder="What is it for? Preferred supplier, delivery instructions…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
        />
      </Field>

      <FormError message={state.error} />
      <SubmitButton className="w-full sm:w-auto">Send request</SubmitButton>
    </form>
  );
}
