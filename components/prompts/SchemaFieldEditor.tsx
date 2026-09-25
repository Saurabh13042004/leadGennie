"use client";

import { CaretDown, Plus, Trash } from "@phosphor-icons/react/ssr";
import type { SchemaField } from "@/lib/actions/prompts";
import Checkbox from "@/components/ui/Checkbox";
import { inputClasses } from "@/components/ui/Field";
import { IconButton } from "@/components/settings/bits";
import { cn } from "@/lib/utils";

export default function SchemaFieldEditor({
  fields,
  onChange,
  showType,
  disabled,
}: {
  fields: SchemaField[];
  onChange: (fields: SchemaField[]) => void;
  showType: boolean;
  disabled?: boolean;
}) {
  function update(idx: number, patch: Partial<SchemaField>) {
    onChange(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  function remove(idx: number) {
    onChange(fields.filter((_, i) => i !== idx));
  }

  function add() {
    onChange([...fields, { key: "", type: "string", required: true }]);
  }

  return (
    <div className="space-y-1.5">
      {fields.map((f, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <input
            aria-label="Field key"
            value={f.key}
            onChange={(e) => update(idx, { key: e.target.value })}
            disabled={disabled}
            placeholder="field_key"
            className={cn(inputClasses, "h-8 min-w-0 flex-1 font-mono text-xs")}
          />
          {showType && (
            <div className="relative shrink-0">
              <select
                aria-label="Field type"
                value={f.type}
                onChange={(e) => update(idx, { type: e.target.value as SchemaField["type"] })}
                disabled={disabled}
                className={cn(inputClasses, "h-8 w-[84px] cursor-pointer appearance-none pr-6 font-mono text-xs")}
              >
                <option value="string">string</option>
                <option value="number">number</option>
              </select>
              <CaretDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-400" weight="bold" />
            </div>
          )}
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 px-1 text-xs text-neutral-500">
            <Checkbox checked={f.required} onChange={(e) => update(idx, { required: e.target.checked })} disabled={disabled} />
            required
          </label>
          {!disabled && <IconButton icon={Trash} label="Remove field" tone="danger" onClick={() => remove(idx)} />}
        </div>
      ))}
      {!disabled && (
        <button
          onClick={add}
          type="button"
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-200 text-xs font-medium text-neutral-500 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-600"
        >
          <Plus className="h-3.5 w-3.5" weight="bold" />
          Add field
        </button>
      )}
      {fields.length === 0 && disabled && <p className="text-xs text-neutral-400">No fields declared.</p>}
    </div>
  );
}
