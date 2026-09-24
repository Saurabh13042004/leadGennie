"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { finishImport, getImportReport, importLeadsChunk, lookupExistingLeads, startImport } from "@/lib/actions/lead-import";
import type { ImportJobView } from "@/lib/domain/leads/import/service";
import type { ReportEntry } from "@/lib/db/lead-import";
import { autoMapHeaders, hasRequiredMapping, type HeaderMapping } from "@/lib/domain/leads/import/headers";
import {
  classifyAgainstExisting,
  DEFAULT_IMPORT_OPTIONS,
  IMPORT_CHUNK_SIZE,
  MAX_IMPORT_ROWS,
  previewImport,
  type ImportOptions,
  type RawRow,
} from "@/lib/domain/leads/import/preview";

export type ImportStep = "choose" | "upload" | "map" | "review" | "importing" | "done";

type Existing = { existing: Set<string>; blocked: Set<string> };
const MAX_CHUNK_ATTEMPTS = 3;

/**
 * State machine for the import wizard. The heavy lifting (mapping, validation,
 * dedupe classification) is the pure domain code; this hook only sequences it
 * and talks to the server actions: startImport → importLeadsChunk × N → finishImport.
 */
export function useLeadImport() {
  const [step, setStep] = useState<ImportStep>("choose");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<HeaderMapping>({});
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_IMPORT_OPTIONS);
  const [existing, setExisting] = useState<Existing | null>(null);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [job, setJob] = useState<ImportJobView | null>(null);
  const [report, setReport] = useState<ReportEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  // Survives a paused import so "Retry" resumes the same job at the failed chunk.
  const runRef = useRef<{ jobId: number; nextChunk: number } | null>(null);
  const idempotencyKey = useRef<string>("");

  const preview = useMemo(() => previewImport(rows, mapping), [rows, mapping]);
  const classification = useMemo(
    () => classifyAgainstExisting(preview, existing?.existing ?? new Set(), existing?.blocked ?? new Set()),
    [preview, existing],
  );
  const canContinueMapping = hasRequiredMapping(mapping);

  const parseFile = useCallback((file: File) => {
    setError(null);
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.replace(/^﻿/, "").trim(),
      complete: (results) => {
        const fields = (results.meta.fields ?? []).filter(Boolean);
        if (fields.length === 0 || results.data.length === 0) {
          setError("That file has no rows. Make sure the first row contains column headers.");
          return;
        }
        if (results.data.length > MAX_IMPORT_ROWS) {
          setError(`That file has ${results.data.length.toLocaleString()} rows — imports are limited to ${MAX_IMPORT_ROWS.toLocaleString()} at a time. Split it and import the parts.`);
          return;
        }
        setFileName(file.name);
        setHeaders(fields);
        setRows(results.data);
        setMapping(autoMapHeaders(fields));
        setExisting(null);
        idempotencyKey.current = crypto.randomUUID();
        setStep("map");
      },
      error: (err) => setError(err.message),
    });
  }, []);

  const goToReview = useCallback(async () => {
    setStep("review");
    setChecking(true);
    setError(null);
    const emails = preview.mapped.flatMap((r) => (r.status === "new" && r.lead?.email ? [r.lead.email] : []));
    const res = emails.length > 0 ? await lookupExistingLeads(emails) : null;
    if (res && !res.ok) setError(`Couldn't check for existing leads: ${res.error.message}`);
    setExisting(res?.ok ? { existing: new Set(res.data.existing), blocked: new Set(res.data.blocked) } : { existing: new Set(), blocked: new Set() });
    setChecking(false);
  }, [preview]);

  const runChunks = useCallback(
    async (jobId: number, from: number) => {
      const all = preview.mapped.map((r) => ({ row: r.row, data: r.input, ...(r.duplicateOf ? { duplicateOf: r.duplicateOf } : {}) }));
      const chunkCount = Math.ceil(all.length / IMPORT_CHUNK_SIZE);
      for (let i = from; i < chunkCount; i++) {
        runRef.current = { jobId, nextChunk: i };
        const slice = all.slice(i * IMPORT_CHUNK_SIZE, (i + 1) * IMPORT_CHUNK_SIZE);
        let lastError = "";
        let done = false;
        // Delivering a chunk twice is a server-side no-op, so retrying is always safe.
        for (let attempt = 0; attempt < MAX_CHUNK_ATTEMPTS && !done; attempt++) {
          try {
            const res = await importLeadsChunk(jobId, { index: i, rows: slice });
            if (res.ok) {
              setProgress({ processed: res.data.job.processedRows, total: res.data.job.totalRows });
              setJob(res.data.job);
              done = true;
            } else if (res.error.code === "CONFLICT" || res.error.code === "NOT_FOUND" || res.error.code === "FORBIDDEN") {
              lastError = res.error.message;
              break; // retrying won't help
            } else {
              lastError = res.error.message;
            }
          } catch {
            lastError = "Network error";
          }
        }
        if (!done) {
          setError(`Import paused at row ${i * IMPORT_CHUNK_SIZE + 2}: ${lastError}. Rows before it were saved — retry to continue.`);
          setPaused(true);
          return;
        }
      }
      runRef.current = null;
      const finished = await finishImport(jobId);
      if (!finished.ok) {
        setError(finished.error.message);
        setPaused(true);
        return;
      }
      setJob(finished.data);
      const rep = await getImportReport(jobId);
      setReport(rep.ok ? rep.data.entries : []);
      setStep("done");
    },
    [preview],
  );

  const startImportRun = useCallback(async () => {
    setError(null);
    setPaused(false);
    setStep("importing");
    setProgress({ processed: 0, total: preview.mapped.length });
    const started = await startImport({
      fileName,
      totalRows: preview.mapped.length,
      options,
      idempotencyKey: idempotencyKey.current,
    });
    if (!started.ok) {
      setError(started.error.message);
      setPaused(true);
      return;
    }
    setJob(started.data);
    await runChunks(started.data.id, 0);
  }, [fileName, options, preview, runChunks]);

  const retry = useCallback(async () => {
    setError(null);
    setPaused(false);
    if (runRef.current) await runChunks(runRef.current.jobId, runRef.current.nextChunk);
    else await startImportRun();
  }, [runChunks, startImportRun]);

  return {
    step, setStep, fileName, headers, rows, mapping, setMapping, options, setOptions,
    preview, classification, checking, progress, job, report, error, paused, canContinueMapping,
    parseFile, goToReview, startImportRun, retry,
  };
}

export type LeadImport = ReturnType<typeof useLeadImport>;
