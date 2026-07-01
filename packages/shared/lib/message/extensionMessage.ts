/** True when the message sender belongs to this extension (popup, background, content script, etc.). */
export function isTrustedExtensionSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id;
}
