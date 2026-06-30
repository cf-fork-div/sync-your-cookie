import {
  collectFolderOptionsFromDomainConfig,
  ENTRY_TYPE_OPTIONS,
  formatEntryTypeLabel,
  type DomainEntryRow,
} from '@sync-your-cookie/shared';

export { ENTRY_TYPE_OPTIONS, formatEntryTypeLabel };

export function collectFolderOptions(entries: DomainEntryRow[]): string[] {
  const folders = entries.map(entry => entry.folder).filter(Boolean) as string[];
  return [...new Set(folders)].sort();
}

export { collectFolderOptionsFromDomainConfig };
