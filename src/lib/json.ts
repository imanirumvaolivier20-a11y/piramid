/** Parses a hidden form field holding a JSON array; anything else becomes []. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseJsonList(value: FormDataEntryValue | null): any[] {
  try {
    const list = JSON.parse(String(value ?? "[]"));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
