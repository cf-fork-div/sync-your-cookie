import { useI18n } from '@sync-your-cookie/shared';

import { cn } from '@sync-your-cookie/ui';

import { Database, Globe } from 'lucide-react';

type DomainItem = {
  host: string;

  cookieCount: number;

  localStorageCount: number;
};

type DomainListProps = {
  domains: DomainItem[];

  selected: string;

  onSelect: (host: string) => void;

  search?: string;
};

export function DomainList({ domains, selected, onSelect, search = '' }: DomainListProps) {
  const { t } = useI18n();

  if (domains.length === 0) {
    const message = search.trim() ? t('noMatchingDomains') : t('emptyCookieData');

    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">{message}</div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <div className="px-3 py-2 border-b border-border text-sm font-medium bg-muted/40">{t('domainList')}</div>

      <ul className="max-h-[70vh] overflow-y-auto divide-y divide-border">
        {domains.map(item => (
          <li key={item.host}>
            <button
              type="button"
              onClick={() => onSelect(item.host)}
              className={cn(
                'w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors',

                selected === item.host && 'bg-primary/10 border-l-2 border-l-primary',
              )}>
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-muted-foreground shrink-0" />

                <span className="font-medium text-sm truncate">{item.host}</span>
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
        ))}
      </ul>
    </div>
  );
}
