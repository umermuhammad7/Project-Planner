const SENSITIVE_KEY_PATTERN = /authorization|password|token|secret|api[_-]?key|refresh[_-]?token|access[_-]?token/i;

export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) {
    return value;
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactForLog(entry, depth + 1));
  }

  if (typeof value !== "object") {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = "[REDACTED]";
      continue;
    }

    output[key] = redactForLog(entry, depth + 1);
  }

  return output;
}

export function logSafeError(error: unknown) {
  if (error instanceof Error) {
    console.error(
      redactForLog({
        name: error.name,
        message: error.message,
        stack: error.stack
      })
    );
    return;
  }

  console.error(redactForLog(error));
}
