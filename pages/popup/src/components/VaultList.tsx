import {
  buildDomainEntryList,
  formatAccountOptionSubtitle,
  getTabsByHost,
  type DomainEntryRow,
  useI18n,
  useStorageSuspense,
} from '@sync-your-cookie/shared';
import { cookieStorage } from '@sync-your-cookie/storage/lib/cookieStorage';
import { domainConfigStorage } from '@sync-your-cookie/storage/lib/domainConfigStorage';
import { domainStatusStorage } from '@sync-your-cookie/storage/lib/domainStatusStorage';
import { Image, Input } from '@sync-your-cookie/ui';
import { ChevronRight, CloudDownload, RotateCw, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

type HostGroup = {
  host: string;
  entries: DomainEntryRow[];
  favIconUrl?: string;
  href: string;
  latestUpdate: number;
};

const getRowHref = (row: DomainEntryRow): string => {
  const protocol = row.sourceUrl ? new URL(row.sourceUrl).protocol : 'https:';
  return `${protocol}//${row.host}`;
};

const openOrFocusHost = async (host: string, href: string): Promise<string> => {
  const matchedTabs = await getTabsByHost(host);
  if (matchedTabs.length > 0) {
    const tab = matchedTabs.find(item => item.active) ?? matchedTabs[0];
    if (tab?.id) {
      await chrome.tabs.update(tab.id, { active: true });
      if (tab.windowId !== undefined) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      return tab.url || href;
    }
  }
  const tab = await chrome.tabs.create({ url: href });
  return tab.url || href;
};

type VaultListProps = {
  currentHost?: string;
  activeTabUrl?: string;
  disabled?: boolean;
  onAccountPull: (tabUrl: string, storageKey: string) => void | Promise<void>;
};

export function VaultList({ currentHost, activeTabUrl, disabled, onAccountPull }: VaultListProps) {
  const { t } = useI18n();
  const cookieMap = useStorageSuspense(cookieStorage);
  const domainConfig = useStorageSuspense(domainConfigStorage);
  const domainStatus = useStorageSuspense(domainStatusStorage);
  const [search, setSearch] = useState('');
  const [actingKey, setActingKey] = useState('');

  const defaultLabel = t('defaultAccount');
  const allEntries = useMemo(
    () => buildDomainEntryList(cookieMap, domainConfig, defaultLabel),
    [cookieMap, domainConfig, defaultLabel],
  );

  const hostGroups = useMemo(() => {
    const map = new Map<string, DomainEntryRow[]>();
    for (const row of allEntries) {
      const list = map.get(row.host) ?? [];
      list.push(row);
      map.set(row.host, list);
    }

    const groups: HostGroup[] = [...map.entries()].map(([host, entries]) => {
      const sorted = [...entries].sort((a, b) => a.label.localeCompare(b.label));
      const primary = sorted[0]!;
      return {
        host,
        entries: sorted,
        favIconUrl: sorted.find(entry => entry.favIconUrl)?.favIconUrl,
        href: getRowHref(primary),
        latestUpdate: Math.max(...sorted.map(entry => entry.updateTime)),
      };
    });

    const normalizedCurrentHost = currentHost?.split(':')[0] ?? '';
    return groups.sort((a, b) => {
      const aCurrent = normalizedCurrentHost && a.host === normalizedCurrentHost;
      const bCurrent = normalizedCurrentHost && b.host === normalizedCurrentHost;
      if (aCurrent && !bCurrent) {
        return -1;
      }
      if (!aCurrent && bCurrent) {
        return 1;
      }
      return b.latestUpdate - a.latestUpdate;
    });
  }, [allEntries, currentHost]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return hostGroups;
    }
    return hostGroups.filter(group => {
      if (group.host.toLowerCase().includes(query)) {
        return true;
      }
      return group.entries.some(entry => {
        const subtitle = formatAccountOptionSubtitle(entry, t) ?? '';
        return (
          entry.label.toLowerCase().includes(query) ||
          (entry.folder?.toLowerCase().includes(query) ?? false) ||
          subtitle.toLowerCase().includes(query)
        );
      });
    });
  }, [hostGroups, search, t]);

  const handleHostOpen = async (group: HostGroup) => {
    if (disabled) {
      return;
    }
    await openOrFocusHost(group.host, group.href);
  };

  const handleAccountActivate = async (row: DomainEntryRow) => {
    if (disabled || actingKey) {
      return;
    }
    setActingKey(row.storageKey);
    try {
      await domainConfigStorage.setLastSelectedEntry(row.host, row.storageKey);
      const href = getRowHref(row);
      let tabUrl = activeTabUrl && activeTabUrl.includes(row.host) ? activeTabUrl : href;
      const matchedTabs = await getTabsByHost(row.host);
      if (matchedTabs.length === 0) {
        const tab = await chrome.tabs.create({ url: href });
        tabUrl = tab.url || href;
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        tabUrl = await openOrFocusHost(row.host, href);
      }
      await onAccountPull(tabUrl, row.storageKey);
    } finally {
      setActingKey('');
    }
  };

  const isHostCurrent = (host: string) => {
    if (!currentHost) {
      return false;
    }
    return host === currentHost.split(':')[0];
  };

  const renderAccountMeta = (entry: DomainEntryRow, multiAccount: boolean) => {
    const subtitle = formatAccountOptionSubtitle(entry, t);
    if (multiAccount) {
      return (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">{entry.label}</p>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      );
    }
    const parts = [entry.label !== defaultLabel && entry.label !== entry.host ? entry.label : null, subtitle].filter(
      Boolean,
    );
    if (parts.length === 0) {
      return null;
    }
    return <p className="truncate text-xs text-muted-foreground">{parts.join(' · ')}</p>;
  };

  return (
    <div className="w-full min-w-0">
      <div className="relative mb-2">
        <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder={t('searchSites')}
          className="h-8 pl-8 pr-8 text-sm"
        />
        {search ? (
          <button
            type="button"
            aria-label={t('filter')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearch('')}>
            <X size={14} />
          </button>
        ) : null}
      </div>

      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t('savedSites')}</p>

      {filteredGroups.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          {t('noSavedSites')}
        </p>
      ) : (
        <div className="max-h-[300px] overflow-y-auto rounded-md border border-border">
          {filteredGroups.map(group => {
            const multiAccount = group.entries.length > 1;
            const isCurrent = isHostCurrent(group.host);

            if (!multiAccount) {
              const entry = group.entries[0]!;
              const pulling = domainStatus?.domainMap?.[entry.storageKey]?.pulling;
              const isActing = actingKey === entry.storageKey;
              return (
                <button
                  key={entry.storageKey}
                  type="button"
                  disabled={disabled || Boolean(actingKey)}
                  title={t('switchAndPull')}
                  onClick={() => void handleAccountActivate(entry)}
                  className={`flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-accent/60 disabled:opacity-60 ${
                    isCurrent ? 'bg-primary/5' : ''
                  }`}>
                  <Image src={group.favIconUrl || ''} value={group.host} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{group.host}</p>
                    {renderAccountMeta(entry, false)}
                  </div>
                  {isActing || pulling ? (
                    <RotateCw size={14} className="shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    <CloudDownload size={14} className="shrink-0 text-muted-foreground" />
                  )}
                </button>
              );
            }

            return (
              <div key={group.host} className={isCurrent ? 'bg-primary/5' : ''}>
                <button
                  type="button"
                  disabled={disabled}
                  title={t('openSite')}
                  onClick={() => void handleHostOpen(group)}
                  className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left transition-colors hover:bg-accent/60 disabled:opacity-60">
                  <Image src={group.favIconUrl || ''} value={group.host} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{group.host}</p>
                    <p className="text-xs text-muted-foreground">{t('accountsForHost', { count: group.entries.length })}</p>
                  </div>
                  <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
                </button>
                {group.entries.map(entry => {
                  const pulling = domainStatus?.domainMap?.[entry.storageKey]?.pulling;
                  const isActing = actingKey === entry.storageKey;
                  return (
                    <button
                      key={entry.storageKey}
                      type="button"
                      disabled={disabled || Boolean(actingKey)}
                      title={t('switchAndPull')}
                      onClick={() => void handleAccountActivate(entry)}
                      className="flex w-full items-center gap-2 border-b border-border py-2 pl-10 pr-3 text-left transition-colors last:border-b-0 hover:bg-accent/60 disabled:opacity-60">
                      {renderAccountMeta(entry, true)}
                      {isActing || pulling ? (
                        <RotateCw size={14} className="shrink-0 animate-spin text-muted-foreground" />
                      ) : (
                        <CloudDownload size={14} className="shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
