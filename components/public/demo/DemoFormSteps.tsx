"use client";

import type { ChangeEvent, ReactNode } from "react";
import { Check, WarningCircle } from "@phosphor-icons/react/ssr";
import { Input, Label, Select } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { CHALLENGES, COMPANY_SIZES, CRM_OPTIONS, OUTBOUND_VOLUMES, type DemoErrors, type DemoField, type DemoFormData } from "./demo-form-core";

type OnChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;

const STEPS = ["About you", "Your outbound"];

export function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-medium">
        <span className="uppercase tracking-wider text-neutral-500">Step {step} of 2</span>
        <span className="text-neutral-400">{STEPS[step - 1]}</span>
      </div>
      <ol className="mt-2.5 grid grid-cols-2 gap-1.5" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={step === i + 1 ? "step" : undefined}>
            <span className={cn("block h-1 rounded-full transition-colors duration-300", step > i ? "bg-neutral-900" : "bg-neutral-200")} />
            <span className="sr-only">{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Field({ id, label, error, children }: { id: DemoField; label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={`demo-${id}`}>{label}</Label>
      {children}
      {error && (
        <p id={`demo-${id}-error`} className="mt-1.5 flex items-center gap-1 text-xs text-rose-600">
          <WarningCircle className="h-3.5 w-3.5 shrink-0" weight="fill" />
          {error}
        </p>
      )}
    </div>
  );
}

const invalid = (error?: string) => (error ? "ring-rose-300 hover:ring-rose-400 focus:ring-rose-500/40" : undefined);
const aria = (id: DemoField, error?: string) => ({ id: `demo-${id}`, "aria-invalid": !!error || undefined, "aria-describedby": error ? `demo-${id}-error` : undefined });

export function StepOne({ data, errors, onChange }: { data: DemoFormData; errors: DemoErrors; onChange: OnChange }) {
  return (
    <div className="space-y-4">
      <Field id="name" label="Full Name" error={errors.name}>
        <Input {...aria("name", errors.name)} type="text" name="name" value={data.name} onChange={onChange} placeholder="Jane Chen" autoComplete="name" required className={cn("h-10", invalid(errors.name))} />
      </Field>
      <Field id="email" label="Work Email" error={errors.email}>
        <Input {...aria("email", errors.email)} type="email" name="email" value={data.email} onChange={onChange} placeholder="jane@company.com" autoComplete="email" required className={cn("h-10", invalid(errors.email))} />
      </Field>
      <Field id="company" label="Company Name" error={errors.company}>
        <Input {...aria("company", errors.company)} type="text" name="company" value={data.company} onChange={onChange} placeholder="Acme Corp" autoComplete="organization" required className={cn("h-10", invalid(errors.company))} />
      </Field>
      <Field id="companySize" label="Company Size" error={errors.companySize}>
        <Select {...aria("companySize", errors.companySize)} name="companySize" value={data.companySize} onChange={onChange} required className={cn("[&>select]:h-10", data.companySize ? "" : "[&>select]:text-neutral-400", errors.companySize && "[&>select]:ring-rose-300")}>
          <option value="" disabled>
            Select size
          </option>
          {COMPANY_SIZES.map((o) => (
            <option key={o.value} value={o.value} className="text-neutral-900">
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

export function StepTwo({ data, errors, onChange, onToggle }: { data: DemoFormData; errors: DemoErrors; onChange: OnChange; onToggle: (c: string) => void }) {
  return (
    <div className="space-y-5">
      <Field id="outboundVolume" label="Current Outbound Volume" error={errors.outboundVolume}>
        <Select {...aria("outboundVolume", errors.outboundVolume)} name="outboundVolume" value={data.outboundVolume} onChange={onChange} required className={cn("[&>select]:h-10", data.outboundVolume ? "" : "[&>select]:text-neutral-400", errors.outboundVolume && "[&>select]:ring-rose-300")}>
          <option value="" disabled>
            Select volume
          </option>
          {OUTBOUND_VOLUMES.map((o) => (
            <option key={o.value} value={o.value} className="text-neutral-900">
              {o.label}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset>
        <legend className="mb-1.5 flex w-full items-baseline justify-between text-[13px] font-medium text-neutral-800">
          Your biggest challenge
          <span className="text-[11px] font-normal text-neutral-400">Select any</span>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {CHALLENGES.map((c) => {
            const on = data.challenges.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(c)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50",
                  on ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "bg-white text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-neutral-200 hover:bg-neutral-50 hover:ring-neutral-300",
                )}
              >
                <span className={cn("flex h-3.5 w-3.5 items-center justify-center rounded-[4px] ring-1 ring-inset", on ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white ring-neutral-300")}>
                  {on && <Check className="h-2.5 w-2.5" weight="bold" />}
                </span>
                {c}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field id="crmUsed" label="CRM Used" error={errors.crmUsed}>
        <Select {...aria("crmUsed", errors.crmUsed)} name="crmUsed" value={data.crmUsed} onChange={onChange} required className={cn("[&>select]:h-10", data.crmUsed ? "" : "[&>select]:text-neutral-400", errors.crmUsed && "[&>select]:ring-rose-300")}>
          <option value="" disabled>
            Select CRM
          </option>
          {CRM_OPTIONS.map((crm) => (
            <option key={crm} value={crm} className="text-neutral-900">
              {crm}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
