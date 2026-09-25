"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, UploadSimple } from "@phosphor-icons/react/ssr";
import Button from "@/components/ui/Button";
import ImportLeadsModal from "./import/ImportLeadsModal";
import LeadFormModal from "./LeadFormModal";

/** Header actions for the leads list: add one lead or import a CSV. Renders nothing for viewers. */
export default function LeadsHeader({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  if (!canEdit) return null;

  return (
    <>
      <Button variant="secondary" onClick={() => setAddOpen(true)}>
        <Plus className="h-4 w-4" weight="bold" />
        Add lead
      </Button>
      <Button variant="primary" onClick={() => setImportOpen(true)}>
        <UploadSimple className="h-4 w-4" weight="bold" />
        Import leads
      </Button>

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
