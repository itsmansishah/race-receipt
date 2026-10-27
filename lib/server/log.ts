import "server-only";

// Structured one-line logs, so webhook and worker failures are easy to grep
// ("level":"error") and never silent.

type Level = "info" | "warn" | "error";

function write(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
};

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
