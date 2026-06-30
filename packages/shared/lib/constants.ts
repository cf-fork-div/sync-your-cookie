export const GITHUB_REPO_URL = 'https://github.com/jackluson/sync-your-cookie';

export function getExtensionVersion(): string {
  return chrome.runtime.getManifest().version;
}
export const GITHUB_HOW_TO_USE_URL = `${GITHUB_REPO_URL}/blob/main/how-to-use.md`;
export const OPTIONS_PAGE_PATH = 'options/index.html';

export function openExtensionOptionsPage(): void {
  // Always open in a new tab — reliable from popup (popup closes before async query callbacks run).
  void chrome.tabs.create({ url: chrome.runtime.getURL(OPTIONS_PAGE_PATH) });
}
