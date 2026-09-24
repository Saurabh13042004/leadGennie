"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Upload, Plus } from "lucide-react";
import ImportLeadsModal from "./import/ImportLeadsModal";
import LeadFormModal from "./LeadFormModal";

export default function LeadsHeader({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">Leads</h1>
            <p className="text-sm text-neutral-500">Import, enrich and segment your lead universe.</p>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 border border-neutral-200 bg-white text-neutral-700 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add lead
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 bg-neutral-900 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-neutral-800 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import leads
            </button>
          </div>
        )}
      </div>

      {importOpen && <ImportLeadsModal onClose={() => setImportOpen(false)} />}
      {addOpen && (
        <LeadFormModal
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
