"use client";

import { useActionState, useState } from "react";
import { FormError, FormSuccess, SubmitButton } from "@/components/forms";
import { buttonClass, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Status = "PRESENT" | "HALF_DAY" | "ABSENT";
type Row = {
  workerId: string;
  name: string;
  detail: string;
  status: Status | null;
  rate: number | null;
  /** Recorded on another project that day, so it cannot be changed here. */
  lockedBy: string | null;
};

const options: { value: Status; label: string; on: string }[] = [
  { value: "PRESENT", label: "Present", on: "peer-checked:bg-emerald-600 peer-checked:text-white peer-checked:border-emerald-600" },
  { value: "HALF_DAY", label: "Half day", on: "peer-checked:bg-amber-500 peer-checked:text-zinc-950 peer-checked:border-amber-500" },
  { value: "ABSENT", label: "Absent", on: "peer-checked:bg-zinc-700 peer-checked:text-white peer-checked:border-zinc-700" },
];

const share: Record<Status, number> = { PRESENT: 1, HALF_DAY: 0.5, ABSENT: 0 };

export function AttendanceForm({
  action,
  date,
  rows,
  showMoney,
  currency,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  date: string;
  rows: Row[];
  showMoney: boolean;
  currency: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [statuses, setStatuses] = useState<Record<string, Status | null>>(
    Object.fromEntries(rows.map((row) => [row.workerId, row.status])),
  );
  const [rates, setRates] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((row) => [row.workerId, row.rate === null ? "" : String(row.rate)])),
  );

  const editable = rows.filter((row) => !row.lockedBy);
  const counts = { PRESENT: 0, HALF_DAY: 0, ABSENT: 0 };
  let total = 0;
  for (const row of rows) {
    const status = statuses[row.workerId];
    if (!status) continue;
    counts[status]++;
    total += (Number(rates[row.workerId]) || 0) * share[status];
  }
  const unmarked = editable.filter((row) => !statuses[row.workerId]).length;

  function markAll(status: Status) {
    setStatuses((current) => ({ ...current, ...Object.fromEntries(editable.map((row) => [row.workerId, status])) }));
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="date" value={date} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => markAll("PRESENT")} className={buttonClass.secondary}>
          Mark everyone present
        </button>
        <p className="text-sm text-zinc-600">
          {counts.PRESENT} present · {counts.HALF_DAY} half day · {counts.ABSENT} absent
          {unmarked > 0 && <span className="text-amber-700"> · {unmarked} not marked</span>}
        </p>
      </div>

      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
        {rows.map((row) => (
          <li key={row.workerId} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
            <div className="min-w-0">
              <p className="font-medium text-zinc-900">{row.name}</p>
              <p className="text-sm text-zinc-500">
                {row.lockedBy ? `Recorded on ${row.lockedBy} today` : row.detail}
                {showMoney && !row.lockedBy && row.rate === null && !rates[row.workerId] && (
                  <span className="text-amber-700"> · no daily rate set</span>
                )}
              </p>
            </div>
            {!row.lockedBy && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex" role="radiogroup" aria-label={`Attendance for ${row.name}`}>
                  {options.map((option, index) => (
                    <label key={option.value} className="cursor-pointer">
                      <input
                        type="radio"
                        name={`status-${row.workerId}`}
                        value={option.value}
                        checked={statuses[row.workerId] === option.value}
                        onChange={() => setStatuses((current) => ({ ...current, [row.workerId]: option.value }))}
                        className="peer sr-only"
                      />
                      <span
                        className={`flex min-h-11 items-center border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 ${option.on} ${
                          index === 0 ? "rounded-l-lg" : index === options.length - 1 ? "-ml-px rounded-r-lg" : "-ml-px"
                        }`}
                      >
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
                {showMoney && (
                  <input
                    type="number"
                    name={`rate-${row.workerId}`}
                    min={0}
                    step="any"
                    inputMode="decimal"
                    placeholder="Daily rate"
                    aria-label={`Daily rate for ${row.name} (${currency})`}
                    value={rates[row.workerId]}
                    onChange={(e) => setRates((current) => ({ ...current, [row.workerId]: e.target.value }))}
                    className={`${inputClass} w-28 py-2`}
                  />
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SubmitButton className="w-full sm:w-auto">Save attendance</SubmitButton>
        {showMoney && (
          <p className="text-sm text-zinc-700">
            Wages for the day: <strong>{total.toLocaleString("en")} {currency}</strong>
          </p>
        )}
      </div>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
    </form>
  );
}
