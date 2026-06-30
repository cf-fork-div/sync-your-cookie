import { translate } from '@sync-your-cookie/shared';
import { localeStorage, resolveLocale } from '@sync-your-cookie/storage/lib/localeStorage';

let globalMenuId: number | string = '';
let clickListenerRegistered = false;

const getContextMenuTitle = async (): Promise<string> => {
  const preference = await localeStorage.get();
  const locale = resolveLocale(preference);
  return translate(locale, 'openCookieManager');
};

export const updateContextMenuTitle = async () => {
  if (!globalMenuId) {
    return;
  }
  const title = await getContextMenuTitle();
  await chrome.contextMenus.update('openSidePanel', { title });
};

export const initContextMenu = async () => {
  const title = await getContextMenuTitle();
  try {
    await chrome.contextMenus.remove('openSidePanel');
  } catch {
    // Menu may not exist yet.
  }
  globalMenuId = chrome.contextMenus.create({
    id: 'openSidePanel',
    title,
    contexts: ['all'],
  });
  if (!clickListenerRegistered) {
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'openSidePanel' && tab?.windowId) {
        // This will open the panel in all the pages on the current window.
        console.log('openSidePanel->tab', tab);
        chrome.sidePanel.open({ windowId: tab.windowId });
      }
    });
    clickListenerRegistered = true;
  }
};

export const removeContextMenu = () => {
  if (globalMenuId) {
    chrome.contextMenus.remove(globalMenuId);
    globalMenuId = '';
  }
};
