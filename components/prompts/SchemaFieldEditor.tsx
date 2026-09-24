"use client";

import { Plus, Trash2 } from "lucide-react";
import type { SchemaField } from "@/lib/actions/prompts";

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
    <div className="space-y-2">
      {fields.map((f, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            value={f.key}
            onChange={(e) => update(idx, { key: e.target.value })}
            disabled={disabled}
            placeholder="field_key"
            className="flex-1 rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 disabled:opacity-60"
          />
          {showType && (
            <select
              value={f.type}
              onChange={(e) => update(idx, { type: e.target.value as SchemaField["type"] })}
              disabled={disabled}
              className="bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-900 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 disabled:opacity-60"
            >
              <option value="string">string</option>
              <option value="number">number</option>
            </select>
          )}
          <label className="flex items-center gap-1.5 text-xs text-neutral-500 shrink-0">
            <input
              type="checkbox"
              checked={f.required}
              onChange={(e) => update(idx, { required: e.target.checked })}
              disabled={disabled}
              className="w-3.5 h-3.5 accent-indigo-600"
            />
            required
          </label>
          {!disabled && (
            <button
              onClick={() => remove(idx)}
              className="text-neutral-400 hover:text-rose-600 transition-colors shrink-0"
              aria-label="Remove field"
              type="button"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          onClick={add}
          type="button"
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add field
        </button>
      )}
      {fields.length === 0 && disabled && <p className="text-xs text-neutral-400">No fields declared.</p>}
    </div>
  );
}
