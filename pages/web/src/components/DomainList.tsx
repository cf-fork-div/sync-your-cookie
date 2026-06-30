import { getDisplaySubtitle, getDisplayTitle, type DomainEntryRow, useI18n } from '@sync-your-cookie/shared';

import { cn } from '@sync-your-cookie/ui';

import { Database, Globe } from 'lucide-react';

type DomainListProps = {
  entries: DomainEntryRow[];

  selected: string;

  onSelect: (storageKey: string) => void;

  search?: string;
};

export function DomainList({ entries, selected, onSelect, search = '' }: DomainListProps) {
  const { t } = useI18n();

  if (entries.length === 0) {
    const message = search.trim() ? t('noMatchingDomains') : t('emptyCookieData');

    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">{message}</div>
    );
  }

  const defaultLabel = t('defaultAccount');

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <div className="px-3 py-2 border-b border-border text-sm font-medium bg-muted/40">{t('domainList')}</div>

      <ul className="max-h-[70vh] overflow-y-auto divide-y divide-border">
        {entries.map(item => {
          const subtitle = getDisplaySubtitle(item, entries, defaultLabel);

          return (
            <li key={item.storageKey}>
              <button
                type="button"
                onClick={() => onSelect(item.storageKey)}
                className={cn(
                  'w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors',

                  selected === item.storageKey && 'bg-primary/10 border-l-2 border-l-primary',
                )}>
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-muted-foreground shrink-0" />

                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-sm truncate block">{getDisplayTitle(item)}</span>
                    {subtitle && (
                      <span className="text-xs text-muted-foreground truncate block">{subtitle}</span>
                    )}
                  </div>
                </div>

                <div className="mt-1 flex gap-3 text-xs text-muted-foreground pl-5">
                  <span>{item.cookieCount} cookies</span>

                  {item.localStorageCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Database size={12} />
                      {item.localStorageCount} ls
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
