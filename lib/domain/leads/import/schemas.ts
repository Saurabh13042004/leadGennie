import { z } from "zod";
import { IMPORT_FIELDS } from "../validate";
import { IMPORT_CHUNK_SIZE, MAX_IMPORT_ROWS } from "./preview";

/** Wire shapes for the import server actions — parsed at the boundary, typed inward. */

const cell = z.string().max(2000).optional();
const leadInput = z.object(
  Object.fromEntries(IMPORT_FIELDS.map((f) => [f, cell])) as Record<(typeof IMPORT_FIELDS)[number], typeof cell>,
);

export const importOptionsSchema = z.object({
  existing: z.enum(["skip", "update_blank"]),
  checkMx: z.boolean(),
});

export const startImportSchema = z.object({
  fileName: z.string().max(255).nullish(),
  totalRows: z.number().int().min(1).max(MAX_IMPORT_ROWS),
  options: importOptionsSchema,
  idempotencyKey: z.string().min(8).max(100).nullish(),
});

export const chunkSchema = z.object({
  index: z.number().int().min(0).max(Math.ceil(MAX_IMPORT_ROWS / IMPORT_CHUNK_SIZE)),
  rows: z
    .array(
      z.object({
        row: z.number().int().min(1).max(MAX_IMPORT_ROWS + 10),
        data: leadInput,
        duplicateOf: z.number().int().min(1).optional(),
      }),
    )
    .min(1)
    .max(IMPORT_CHUNK_SIZE),
});

export const emailListSchema = z.array(z.string().max(320)).max(MAX_IMPORT_ROWS);
export const jobIdSchema = z.number().int().positive();
