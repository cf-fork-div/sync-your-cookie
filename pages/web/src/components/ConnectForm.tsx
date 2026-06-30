import { fetchDatasourceStatus, saveDatasourceConfig } from '@src/lib/datasource';
import { mapApiErrorCode } from '@src/lib/api';
import { loadSession, parseRawContent } from '@src/lib/cookies';
import { detectFormat } from '@src/lib/mutations';
import type { DatasourceStatus } from '@src/lib/datasource';
import type { ViewerSession } from '@src/lib/types';
import { useI18n } from '@sync-your-cookie/shared';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@sync-your-cookie/ui';
import { ClipboardPaste, Cloud, Loader2 } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';

type SourceTab = 'cloudflare' | 'paste';

type ConnectFormProps = {
  onLoaded: (session: ViewerSession) => void;
};

function serverManagedSession(status: DatasourceStatus, encryptionPassword?: string): Promise<ViewerSession> {
  const storageKey = status.storageKey || 'sync-your-cookie';
  return loadSession({
    dataSource: {
      type: 'cloudflare',
      accountId: status.accountId || '',
      namespaceId: status.namespaceId || '',
      token: '',
      storageKey,
      useProxy: true,
      serverManaged: true,
    },
    encryptionPassword,
  });
}

export function ConnectForm({ onLoaded }: ConnectFormProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<SourceTab>('cloudflare');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoLoadFailed, setAutoLoadFailed] = useState(false);
  const [savedConfigured, setSavedConfigured] = useState(false);
  const [tokenMasked, setTokenMasked] = useState<string | undefined>();

  const [accountId, setAccountId] = useState('');
  const [namespaceId, setNamespaceId] = useState('');
  const [token, setToken] = useState('');
  const [storageKey, setStorageKey] = useState('sync-your-cookie');

  const [pasteContent, setPasteContent] = useState('');
  const [encryptionPassword, setEncryptionPassword] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const status = await fetchDatasourceStatus();
        if (cancelled) {
          return;
        }

        if (!status.configured) {
          setLoadingStatus(false);
          return;
        }

        setSavedConfigured(true);
        setAccountId(status.accountId || '');
        setNamespaceId(status.namespaceId || '');
        setStorageKey(status.storageKey || 'sync-your-cookie');
        setTokenMasked(status.tokenMasked);

        setAutoLoading(true);
        try {
          const session = await serverManagedSession(status);
          if (cancelled) {
            return;
          }
          onLoaded(session);
        } catch (error) {
          if (cancelled) {
            return;
          }
          setAutoLoadFailed(true);
          const message = error instanceof Error ? mapApiErrorCode(error.message, t) : t('loadFailed');
          toast.error(message);
        } finally {
          if (!cancelled) {
            setAutoLoading(false);
            setLoadingStatus(false);
          }
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? mapApiErrorCode(error.message, t) : t('loadFailed');
        toast.error(message);
        setLoadingStatus(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [onLoaded, t]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (tab === 'cloudflare') {
        if (!accountId.trim() || !namespaceId.trim()) {
          toast.warning(t('fillCloudflareConfig'));
          return;
        }
        if (!savedConfigured && !token.trim()) {
          toast.warning(t('fillCloudflareConfig'));
          return;
        }

        const key = storageKey.trim() || 'sync-your-cookie';
        if (token.trim()) {
          await saveDatasourceConfig({
            accountId: accountId.trim(),
            namespaceId: namespaceId.trim(),
            token: token.trim(),
            storageKey: key,
          });
          setSavedConfigured(true);
          setAutoLoadFailed(false);
        }

        const session = await loadSession({
          dataSource: {
            type: 'cloudflare',
            accountId: accountId.trim(),
            namespaceId: namespaceId.trim(),
            token: token.trim(),
            storageKey: key,
            useProxy: true,
            serverManaged: true,
          },
          encryptionPassword: encryptionPassword || undefined,
        });
        onLoaded(session);
      } else {
        if (!pasteContent.trim()) {
          toast.warning(t('pasteKvContent'));
          return;
        }
        const format = detectFormat(pasteContent, encryptionPassword || undefined);
        const parsed = await parseRawContent(pasteContent, {
          encryptionPassword: encryptionPassword || undefined,
        });
        onLoaded({
          cookieMap: {
            ...parsed,
            domainCookieMap: parsed.domainCookieMap ?? {},
          },
          dataSource: { type: 'paste' },
          format,
          canWrite: false,
        });
      }
      toast.success(t('loadSuccess'));
    } catch (error) {
      const message =
        error instanceof Error ? mapApiErrorCode(error.message, t) : t('loadFailed');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: SourceTab; label: string; icon: ReactNode }[] = [
    { id: 'cloudflare', label: 'Cloudflare KV', icon: <Cloud size={16} /> },
    { id: 'paste', label: t('pasteContent'), icon: <ClipboardPaste size={16} /> },
  ];

  if (loadingStatus || autoLoading) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
          {t('loadingSavedConfig')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{t('connectDataSource')}</CardTitle>
        <CardDescription>{t('connectDataSourceDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {tabs.map(item => (
            <Button
              key={item.id}
              type="button"
              variant={tab === item.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(item.id)}
              className="gap-1.5">
              {item.icon}
              {item.label}
            </Button>
          ))}
        </div>

        {tab === 'cloudflare' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{t('adminDatasourceHint')}</p>
            {savedConfigured && autoLoadFailed && (
              <p className="text-xs text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-2">
                {tokenMasked
                  ? `${t('apiToken')} ${t('savedOnServer')} (${tokenMasked}). ${t('reenterTokenToLoad')}`
                  : t('reenterTokenToLoad')}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="accountId">{t('accountId')}</Label>
              <Input
                id="accountId"
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="namespaceId">{t('namespaceId')}</Label>
              <Input
                id="namespaceId"
                value={namespaceId}
                onChange={e => setNamespaceId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token">{t('apiToken')}</Label>
              <Input
                id="token"
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder={savedConfigured ? t('reenterApiTokenPlaceholder') : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storageKey">{t('storageKey')}</Label>
              <Input id="storageKey" value={storageKey} onChange={e => setStorageKey(e.target.value)} />
            </div>
          </div>
        )}

        {tab === 'paste' && (
          <div className="space-y-2">
            <Label htmlFor="pasteContent">{t('kvRawContent')}</Label>
            <textarea
              id="pasteContent"
              className="flex min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={t('kvPastePlaceholder')}
              value={pasteContent}
              onChange={e => setPasteContent(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('readonlyPasteNote')}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="encryptionPassword">{t('decryptionPasswordOptional')}</Label>
          <Input
            id="encryptionPassword"
            type="password"
            placeholder={t('decryptionPasswordPlaceholder')}
            value={encryptionPassword}
            onChange={e => setEncryptionPassword(e.target.value)}
          />
        </div>

        <Button className="w-full" onClick={handleSubmit} disabled={loading}>
          {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
          {t('loadCookieData')}
        </Button>
      </CardContent>
    </Card>
  );
}
