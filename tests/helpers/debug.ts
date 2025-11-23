const isEnabled = String(process.env.DEBUG_TEST_LOGS || "").toLowerCase() === "true";

const replacer = (_key: string, value: unknown) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};

export function debugLog(step: string, context?: Record<string, unknown>) {
  if (!isEnabled) return;
  const timestamp = new Date().toISOString();
  const suffix = context ? ` :: ${JSON.stringify(context, replacer)}` : "";
  // eslint-disable-next-line no-console
  console.info(`[TEST_DEBUG][${timestamp}] ${step}${suffix}`);
}

const DRIZZLE_TABLE_NAME = Symbol.for("drizzle:Name");

export function getTableName(table: unknown): string {
  if (!table || typeof table !== "object") return "unknown";
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((table as any)[DRIZZLE_TABLE_NAME] as string | undefined) ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((table as any).tableName as string | undefined) ??
    "unknown"
  );
}
