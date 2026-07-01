/** Normalize hostname for strict comparison (no port, no leading dot, lowercase). */
export function normalizeHostname(host: string): string {
  return host
    .replace(/^\./, '')
    .replace(/^www\./, '')
    .replace(/:\d+$/, '')
    .toLowerCase();
}

/**
 * Strict hostname match for content-script localStorage operations.
 * Accepts exact host or subdomain of the expected host (e.g. www.example.com ↔ example.com).
 */
export function hostnameMatchesPage(pageHostname: string, expectedHost: string): boolean {
  const page = normalizeHostname(pageHostname);
  const expected = normalizeHostname(expectedHost);
  if (!page || !expected) {
    return false;
  }
  if (page === expected) {
    return true;
  }
  return page.endsWith(`.${expected}`);
}
