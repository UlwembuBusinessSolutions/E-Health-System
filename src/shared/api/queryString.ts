/** `a=1&b=2` for a request URL, leaving out values that are unset or empty (but keeping `false` and `0`). */
export function queryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  return search.toString();
}
