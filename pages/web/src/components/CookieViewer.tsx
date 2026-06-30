import { CookieDetail } from '@src/components/CookieDetail';

import { DomainList } from '@src/components/DomainList';

import { useSessionActions } from '@src/hooks/useSessionActions';

import type { ViewerSession } from '@src/lib/types';

import { collectFolderOptions } from '@src/lib/entryMeta';
import {
  buildDomainEntryListFromCookieMap,
  countUniqueHosts,
  getAccountsCountForHost,
  getDisplaySubtitle,
  useI18n,
} from '@sync-your-cookie/shared';

import { Button, Input } from '@sync-your-cookie/ui';

import { ClipboardCopy, Loader2, LogOut, Search } from 'lucide-react';

import { useEffect, useMemo, useState } from 'react';

type CookieViewerProps = {
  session: ViewerSession;

  onSessionChange: (session: ViewerSession) => void;

  onDisconnect: () => void;
};

export function CookieViewer({ session, onSessionChange, onDisconnect }: CookieViewerProps) {
  const { t } = useI18n();

  const [selectedStorageKey, setSelectedStorageKey] = useState('');

  const [search, setSearch] = useState('');

  const { cookieMap, canWrite } = session;

  const actions = useSessionActions({ session, onSessionChange });

  const defaultLabel = t('defaultAccount');

  const entries = useMemo(() => {
    const rows = buildDomainEntryListFromCookieMap(cookieMap, defaultLabel);

    if (!search.trim()) {
      return rows;
    }

    const q = search.trim().toLowerCase();

    return rows.filter(
      item =>
        item.host.toLowerCase().includes(q) ||
        item.label.toLowerCase().includes(q) ||
        item.storageKey.toLowerCase().includes(q),
    );
  }, [cookieMap, defaultLabel, search]);

  const activeStorageKey = selectedStorageKey || entries[0]?.storageKey || '';

  const activeEntry = entries.find(item => item.storageKey === activeStorageKey);

  const activeData = activeStorageKey ? cookieMap.domainCookieMap?.[activeStorageKey] : undefined;

  useEffect(() => {
    if (activeStorageKey && !cookieMap.domainCookieMap?.[activeStorageKey]) {
      setSelectedStorageKey(entries[0]?.storageKey || '');
    }
  }, [activeStorageKey, cookieMap.domainCookieMap, entries]);

  const hostCount = countUniqueHosts(entries);
  const folderOptions = useMemo(() => collectFolderOptions(entries), [entries]);

  return (
    <div className="space-y-4">
      {!canWrite && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          {t('readonlyBanner')}

          <button type="button" className="mx-1 underline font-medium" onClick={actions.exportToClipboard}>
            {t('exportToClipboard')}
          </button>

          {t('readonlyBannerSuffix')}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />

          <Input
            className="pl-9"
            placeholder={t('searchDomain')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <span>{t('entryCount', { count: entries.length })}</span>
          {hostCount !== entries.length && (
            <span className="text-muted-foreground/80">
              ({t('hostCount', { count: hostCount })})
            </span>
          )}

          {actions.saving && (
            <span className="inline-flex items-center gap-1 text-primary">
              <Loader2 size={14} className="animate-spin" />

              {t('saving')}
            </span>
          )}

          {!canWrite && (
            <Button variant="outline" size="sm" onClick={actions.exportToClipboard}>
              <ClipboardCopy size={14} className="mr-1.5" />

              {t('exportContent')}
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={onDisconnect}>
            <LogOut size={14} className="mr-1.5" />

            {t('reconnect')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 min-h-[60vh]">
        <DomainList
          entries={entries}
          selected={activeStorageKey}
          onSelect={setSelectedStorageKey}
          search={search}
        />

        {activeData && activeEntry ? (
          <CookieDetail
            storageKey={activeStorageKey}
            host={activeEntry.host}
            label={getDisplaySubtitle(activeEntry, entries, defaultLabel)}
            folder={activeEntry.folder}
            type={activeEntry.type}
            folderOptions={folderOptions}
            accountsOnHost={getAccountsCountForHost(entries, activeEntry.host)}
            data={activeData}
            search={search}
            canWrite={canWrite}
            saving={actions.saving}
            onEditCookie={(oldItem, newItem) => actions.handleEditCookie(activeStorageKey, oldItem, newItem)}
            onDeleteCookie={cookie => actions.handleDeleteCookie(activeStorageKey, cookie)}
            onEditLocalStorage={(key, value) => actions.handleEditLocalStorage(activeStorageKey, key, value)}
            onDeleteLocalStorage={key => actions.handleDeleteLocalStorage(activeStorageKey, key)}
            onDeleteDomain={() => actions.handleDeleteDomain(activeStorageKey)}
            onUpdateEntryMeta={update => actions.handleUpdateEntryMeta(activeStorageKey, update)}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {entries.length === 0 && !search.trim() ? t('emptyCookieData') : t('noData')}
          </div>
        )}
      </div>
    </div>
  );
}
