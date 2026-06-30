import { CookieDetail } from '@src/components/CookieDetail';
import { DomainTable } from '@src/components/DomainTable';
import { useSessionActions } from '@src/hooks/useSessionActions';
import { collectFolderOptions } from '@src/lib/entryMeta';
import type { ViewerSession } from '@src/lib/types';
import {
  buildDomainEntryListFromCookieMap,
  countUniqueHosts,
  ENTRY_TYPE_OPTIONS,
  getAccountsCountForHost,
  getDisplaySubtitle,
  useI18n,
} from '@sync-your-cookie/shared';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sync-your-cookie/ui';
import { ChevronLeft, ClipboardCopy, Loader2, LogOut, Search, X } from 'lucide-react';
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
  const [folderFilter, setFolderFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const { cookieMap, canWrite } = session;
  const actions = useSessionActions({ session, onSessionChange });
  const defaultLabel = t('defaultAccount');

  const allEntries = useMemo(
    () => buildDomainEntryListFromCookieMap(cookieMap, defaultLabel),
    [cookieMap, defaultLabel],
  );

  const folderOptions = useMemo(() => collectFolderOptions(allEntries), [allEntries]);

  const filteredEntries = useMemo(() => {
    return allEntries.filter(entry => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !entry.host.toLowerCase().includes(q) &&
          !entry.label.toLowerCase().includes(q) &&
          !(entry.folder || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (folderFilter !== 'all') {
        if (folderFilter === '__none__' && entry.folder) return false;
        if (folderFilter !== '__none__' && entry.folder !== folderFilter) return false;
      }
      if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
      return true;
    });
  }, [allEntries, folderFilter, search, typeFilter]);

  const activeEntry = allEntries.find(item => item.storageKey === selectedStorageKey);
  const activeData = selectedStorageKey ? cookieMap.domainCookieMap?.[selectedStorageKey] : undefined;

  useEffect(() => {
    if (selectedStorageKey && !cookieMap.domainCookieMap?.[selectedStorageKey]) {
      setSelectedStorageKey('');
    }
  }, [selectedStorageKey, cookieMap.domainCookieMap]);

  let totalCookieItem = 0;
  let totalLocalStorageItem = 0;
  for (const entry of allEntries) {
    const value = cookieMap.domainCookieMap?.[entry.storageKey];
    if (value?.cookies?.length) {
      totalCookieItem += value.cookies.length;
    }
    if (value?.localStorageItems?.length) {
      totalLocalStorageItem += value.localStorageItems.length;
    }
  }

  const hostCount = countUniqueHosts(allEntries);
  const selectedHost = activeEntry?.host || '';
  const selectedLabel = activeEntry?.label || defaultLabel;
  const sourceUrl = activeEntry?.sourceUrl;
  const protocol = sourceUrl ? new URL(sourceUrl).protocol : 'https:';
  const href = selectedHost ? `${protocol}//${selectedHost}` : '';

  const toolbar = (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
      {actions.saving && (
        <span className="inline-flex items-center gap-1 text-sm text-primary">
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
  );

  if (selectedStorageKey && activeData && activeEntry) {
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
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSelectedStorageKey('')}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">{t('back')}</span>
            </Button>
            <a
              href={href}
              target="_blank"
              className="flex text-lg items-center font-semibold hover:underline truncate"
              rel="noreferrer">
              <span className="truncate">{selectedHost}</span>
              {selectedLabel !== defaultLabel ? (
                <span className="text-sm font-normal text-muted-foreground ml-2 shrink-0">· {selectedLabel}</span>
              ) : null}
            </a>
          </div>
          {toolbar}
        </div>

        <CookieDetail
          storageKey={selectedStorageKey}
          host={activeEntry.host}
          label={getDisplaySubtitle(activeEntry, allEntries, defaultLabel)}
          folder={activeEntry.folder}
          type={activeEntry.type}
          folderOptions={folderOptions}
          accountsOnHost={getAccountsCountForHost(allEntries, activeEntry.host)}
          data={activeData}
          search=""
          canWrite={canWrite}
          saving={actions.saving}
          onEditCookie={(oldItem, newItem) => actions.handleEditCookie(selectedStorageKey, oldItem, newItem)}
          onDeleteCookie={cookie => actions.handleDeleteCookie(selectedStorageKey, cookie)}
          onEditLocalStorage={(key, value) => actions.handleEditLocalStorage(selectedStorageKey, key, value)}
          onDeleteLocalStorage={key => actions.handleDeleteLocalStorage(selectedStorageKey, key)}
          onDeleteDomain={async () => {
            await actions.handleDeleteDomain(selectedStorageKey);
            setSelectedStorageKey('');
          }}
          onUpdateEntryMeta={update => actions.handleUpdateEntryMeta(selectedStorageKey, update)}
        />
      </div>
    );
  }

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

      <div className="flex flex-col sm:flex-row gap-3 sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{t('welcomeBack')}</h2>
          <p className="text-muted-foreground text-sm">{t('pushedList', { type: t('cookies') })}</p>
        </div>
        {toolbar}
      </div>

      <div className="w-full max-w-md bg-primary/10 rounded-xl border text-card-foreground shadow">
        <div className="p-3">
          <p className="tracking-tight text-sm font-normal">{t('totalCookieAndLocalStorage')}</p>
          <p className="text-2xl font-bold">
            {hostCount} <span className="text-xl">{t('sites')}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            <span>{t('cookieItems', { count: totalCookieItem })}</span>
            <span className="mx-1">{t('and')}</span>
            <span>{t('localStorageItemsCount', { count: totalLocalStorageItem })}</span>
          </p>
          {allEntries.length > hostCount ? (
            <p className="text-xs text-primary mt-1">{t('entryCount', { count: allEntries.length })}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={folderFilter} onValueChange={setFolderFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t('folder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allFolders')}</SelectItem>
            <SelectItem value="__none__">{t('noFolder')}</SelectItem>
            {folderOptions.map(folder => (
              <SelectItem key={folder} value={folder}>
                {folder}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('entryType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allTypes')}</SelectItem>
            {ENTRY_TYPE_OPTIONS.map(option => (
              <SelectItem key={option} value={option}>
                {option === 'login' ? t('typeLogin') : option === 'session' ? t('typeSession') : t('typeOther')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute top-[11px] left-[10px] text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 pr-9"
          placeholder={t('filter')}
        />
        {search ? (
          <button
            type="button"
            className="absolute top-[13px] right-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => setSearch('')}
            aria-label={t('filter')}>
            <X size={16} />
          </button>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">{t('autoSyncExtensionOnlyNote')}</p>

      {filteredEntries.length > 0 ? (
        <DomainTable
          entries={filteredEntries}
          allEntries={allEntries}
          onSelect={setSelectedStorageKey}
          getDomainData={storageKey => cookieMap.domainCookieMap?.[storageKey]}
        />
      ) : (
        <div className="rounded-md border border-dashed border-border flex items-center justify-center p-8 text-center text-sm text-muted-foreground">
          {allEntries.length === 0 && !search.trim() && folderFilter === 'all' && typeFilter === 'all'
            ? t('emptyCookieData')
            : t('noMatchingDomains')}
        </div>
      )}
    </div>
  );
}
