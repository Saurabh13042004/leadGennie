/**
 * Structured JSON logger — one line per event, machine-parseable.
 *
 *   const log = createLogger({ request_id, workspace_id });
 *   log.info("campaign.launched", { campaign_id });
 *   log.error("provider.failed", { err });
 *
 * This is the ONLY place allowed to call console.* (see eslint config).
 * Sensitive keys are redacted so a log line can never leak a credential.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const REDACT_KEY = /pass(word)?|token|secret|authorization|api[_-]?key|cookie|credential/i;

export type LogSink = (line: string, level: LogLevel) => void;

const defaultSink: LogSink = (line, level) => {
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

let sink: LogSink = defaultSink;

/** Tests swap the sink to capture (or silence) output. */
export function setLogSink(next: LogSink | null) {
  sink = next ?? defaultSink;
}

function minLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL as LogLevel | undefined;
  if (configured && configured in LEVEL_RANK) return configured;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function serializeError(err: Error): LogFields {
  return { name: err.name, message: err.message, stack: err.stack };
}

function sanitize(value: unknown, depth = 0): unknown {
  if (value instanceof Error) return serializeError(value);
  if (value === null || typeof value !== "object") return value;
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  const out: LogFields = {};
  for (const [k, v] of Object.entries(value as LogFields)) {
    out[k] = REDACT_KEY.test(k) ? "[redacted]" : sanitize(v, depth + 1);
  }
  return out;
}

export type Logger = {
  debug: (msg: string, fields?: LogFields) => void;
  info: (msg: string, fields?: LogFields) => void;
  warn: (msg: string, fields?: LogFields) => void;
  error: (msg: string, fields?: LogFields) => void;
  child: (fields: LogFields) => Logger;
};

export function createLogger(base: LogFields = {}): Logger {
  const emit = (level: LogLevel, msg: string, fields?: LogFields) => {
    if (LEVEL_RANK[level] < LEVEL_RANK[minLevel()]) return;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg,
      ...(sanitize({ ...base, ...fields }) as LogFields),
    });
    sink(line, level);
  };

  return {
    debug: (msg, fields) => emit("debug", msg, fields),
    info: (msg, fields) => emit("info", msg, fields),
    warn: (msg, fields) => emit("warn", msg, fields),
    error: (msg, fields) => emit("error", msg, fields),
    child: (fields) => createLogger({ ...base, ...fields }),
  };
}

export const log = createLogger();
