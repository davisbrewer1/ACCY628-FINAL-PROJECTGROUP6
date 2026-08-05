/** receipt_url may be a single path or a JSON array of paths. */
export function parseReceiptPaths(receiptUrl: string | null | undefined): string[] {
  if (!receiptUrl) return [];
  const trimmed = receiptUrl.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      return [trimmed];
    }
  }
  return [trimmed];
}

export function serializeReceiptPaths(paths: string[]): string | null {
  if (paths.length === 0) return null;
  if (paths.length === 1) return paths[0]!;
  return JSON.stringify(paths);
}
