import { messages, type MessageKey, type MessageParams } from './messages';
import type { ResolvedLocale } from '@sync-your-cookie/storage/lib/localeStorage';

export function translate(locale: ResolvedLocale, key: MessageKey, params?: MessageParams): string {
  const template = messages[locale][key] ?? messages.en[key] ?? key;
  if (!params) {
    return template;
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const value = params[name];
    return value !== undefined ? String(value) : `{{${name}}}`;
  });
}
