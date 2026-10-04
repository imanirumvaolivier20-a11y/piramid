"use client";

import { useActionState, useState } from "react";
import { completeOnboarding } from "@/actions/onboarding";
import { FormError, SubmitButton } from "@/components/forms";
import { Field, inputClass } from "@/components/ui";

type AccountTypeOption = { key: string; label: string; description: string };

function suggestUsername(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

export function OnboardingForm({
  types,
  currencies,
  suggestedName,
}: {
  types: AccountTypeOption[];
  currencies: string[];
  suggestedName: string;
}) {
  const [state, formAction] = useActionState(completeOnboarding, {});
  const [typeKey, setTypeKey] = useState("");
  const [name, setName] = useState(suggestedName);
  const [username, setUsername] = useState(suggestUsername(suggestedName));
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [currency, setCurrency] = useState(currencies[0]);
  const [inviteCode, setInviteCode] = useState("");

  const isCompany = typeKey === "COMPANY";

  return (
    <form action={formAction} className="mt-6 space-y-6">
      <fieldset>
        <legend className="mb-2 font-medium text-zinc-900">What best describes you?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {types.map((type) => (
            <label
              key={type.key}
              className="flex cursor-pointer gap-3 rounded-xl border border-zinc-200 bg-white p-3 has-[:checked]:border-amber-500 has-[:checked]:ring-2 has-[:checked]:ring-amber-500/30"
            >
              <input
                type="radio"
                name="typeKey"
                value={type.key}
                checked={typeKey === type.key}
                onChange={() => setTypeKey(type.key)}
                className="mt-1 accent-amber-500"
              />
              <span>
                <span className="block text-sm font-semibold text-zinc-900">{type.label}</span>
                <span className="block text-sm text-zinc-600">{type.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {typeKey && (
        <div className="space-y-4">
          <Field label={isCompany ? "Company name" : "Your name"}>
            <input
              name="name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!usernameEdited) setUsername(suggestUsername(e.target.value));
              }}
              className={inputClass}
            />
          </Field>

          <Field label="Username" hint="Others use this to find and hire you. Lowercase letters, numbers and dashes.">
            <input
              name="username"
              required
              autoCapitalize="none"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setUsernameEdited(true);
              }}
              className={inputClass}
            />
          </Field>

          <Field label="Currency" hint="Used for budgets, expenses and wages.">
            <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
              {currencies.map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </Field>

          {typeKey === "WORKER" && (
            <Field label="Company invite code (optional)" hint="Ask your company for its code. You can also join later.">
              <input
                name="inviteCode"
                autoCapitalize="characters"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className={inputClass}
              />
            </Field>
          )}

          <SubmitButton className="w-full sm:w-auto">Continue</SubmitButton>
        </div>
      )}
      <FormError message={state.error} />
    </form>
  );
}
