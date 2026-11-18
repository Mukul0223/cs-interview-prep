type Level = "info" | "warn" | "error";

function write(
  level: Level,
  msg: string,
  fields: Record<string, unknown> = {},
) {
  if (process.env.NODE_ENV === "test") return; // keep test output quiet
  const line = JSON.stringify({
    ...fields,
    level,
    msg,
    time: new Date().toISOString(),
  });
  (level === "error" ? process.stderr : process.stdout).write(line + "\n");
}

export const logger = {
  info: (msg: string, fields?: Record<string, unknown>) =>
    write("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) =>
    write("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) =>
    write("error", msg, fields),
};

export function errorFields(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { errName: err.name, errMessage: err.message, stack: err.stack };
  }
  return { errMessage: String(err) };
}
