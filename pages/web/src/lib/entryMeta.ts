import type { DomainEntryRow, MessageKey } from '@sync-your-cookie/shared';

type Translate = (key: MessageKey) => string;

export function formatEntryTypeLabel(t: Translate, type?: DomainEntryRow['type']): string {
  if (type === 'login') return t('typeLogin');
  if (type === 'session') return t('typeSession');
  if (type === 'other') return t('typeOther');
  return '-';
}

export function collectFolderOptions(entries: DomainEntryRow[]): string[] {
  const folders = entries.map(entry => entry.folder).filter(Boolean) as string[];
  return [...new Set(folders)].sort();
}
