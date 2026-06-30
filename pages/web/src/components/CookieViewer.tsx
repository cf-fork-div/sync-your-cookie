import { CookieDetail } from '@src/components/CookieDetail';

import { DomainList } from '@src/components/DomainList';

import { useSessionActions } from '@src/hooks/useSessionActions';

import type { ViewerSession } from '@src/lib/types';

import { useI18n } from '@sync-your-cookie/shared';

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

  const [selectedDomain, setSelectedDomain] = useState('');

  const [search, setSearch] = useState('');

  const { cookieMap, canWrite } = session;

  const actions = useSessionActions({ session, onSessionChange });

  const domains = useMemo(() => {
    const entries = Object.entries(cookieMap.domainCookieMap || {}).map(([host, value]) => ({
      host,

      cookieCount: value.cookies?.length || 0,

      localStorageCount: value.localStorageItems?.length || 0,

      updateTime: value.updateTime || 0,
    }));

    return entries

      .filter(item => {
        if (!search.trim()) return true;

        const q = search.trim().toLowerCase();

        return item.host.toLowerCase().includes(q);
      })

      .sort((a, b) => b.updateTime - a.updateTime);
  }, [cookieMap, search]);

  const activeDomain = selectedDomain || domains[0]?.host || '';

  const activeData = activeDomain ? cookieMap.domainCookieMap?.[activeDomain] : undefined;

  useEffect(() => {
    if (activeDomain && !cookieMap.domainCookieMap?.[activeDomain]) {
      setSelectedDomain(domains[0]?.host || '');
    }
  }, [activeDomain, cookieMap.domainCookieMap, domains]);

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
          <span>{t('domainCount', { count: domains.length })}</span>

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
        <DomainList domains={domains} selected={activeDomain} onSelect={setSelectedDomain} search={search} />

        {activeData ? (
          <CookieDetail
            domain={activeDomain}
            data={activeData}
            search={search}
            canWrite={canWrite}
            saving={actions.saving}
            onEditCookie={(oldItem, newItem) => actions.handleEditCookie(activeDomain, oldItem, newItem)}
            onDeleteCookie={cookie => actions.handleDeleteCookie(activeDomain, cookie)}
            onEditLocalStorage={(key, value) => actions.handleEditLocalStorage(activeDomain, key, value)}
            onDeleteLocalStorage={key => actions.handleDeleteLocalStorage(activeDomain, key)}
            onDeleteDomain={() => actions.handleDeleteDomain(activeDomain)}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {domains.length === 0 && !search.trim() ? t('emptyCookieData') : t('noData')}
          </div>
        )}
      </div>
    </div>
  );
}
