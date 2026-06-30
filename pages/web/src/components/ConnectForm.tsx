import { fetchDatasourceStatus, fetchKvViaServer, saveDatasourceConfig } from '@src/lib/datasource';
import { parseRawContent } from '@src/lib/cookies';
import { detectFormat } from '@src/lib/mutations';
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

export function ConnectForm({ onLoaded }: ConnectFormProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<SourceTab>('cloudflare');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
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
    void fetchDatasourceStatus()
      .then(status => {
        if (cancelled) {
          return;
        }
        if (!status.configured) {
          return;
        }
        setSavedConfigured(true);
        setAccountId(status.accountId || '');
        setNamespaceId(status.namespaceId || '');
        setStorageKey(status.storageKey || 'sync-your-cookie');
        setTokenMasked(status.tokenMasked);
      })
      .catch(() => {
        toast.error(t('loadFailed'));
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingStatus(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (tab === 'cloudflare') {
        if (!accountId.trim() || !namespaceId.trim() || !token.trim()) {
          toast.warning(t('fillCloudflareConfig'));
          return;
        }
        const key = storageKey.trim() || 'sync-your-cookie';
        await saveDatasourceConfig({
          accountId: accountId.trim(),
          namespaceId: namespaceId.trim(),
          token: token.trim(),
          storageKey: key,
        });
        const content = await fetchKvViaServer(key);
        const format = detectFormat(content, encryptionPassword || undefined);
        const parsed = await parseRawContent(content, {
          encryptionPassword: encryptionPassword || undefined,
        });
        onLoaded({
          cookieMap: {
            ...parsed,
            domainCookieMap: parsed.domainCookieMap ?? {},
          },
          dataSource: {
            type: 'cloudflare',
            accountId: accountId.trim(),
            namespaceId: namespaceId.trim(),
            token: token.trim(),
            storageKey: key,
            useProxy: true,
            serverManaged: true,
          },
          format,
          canWrite: true,
        });
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
      const message = error instanceof Error ? error.message : t('loadFailed');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: SourceTab; label: string; icon: ReactNode }[] = [
    { id: 'cloudflare', label: 'Cloudflare KV', icon: <Cloud size={16} /> },
    { id: 'paste', label: t('pasteContent'), icon: <ClipboardPaste size={16} /> },
  ];

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
            {savedConfigured && (
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
                disabled={loadingStatus}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="namespaceId">{t('namespaceId')}</Label>
              <Input
                id="namespaceId"
                value={namespaceId}
                onChange={e => setNamespaceId(e.target.value)}
                disabled={loadingStatus}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token">{t('apiToken')}</Label>
              <Input
                id="token"
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder={
                  loadingStatus
                    ? t('loading')
                    : savedConfigured
                      ? t('reenterApiTokenPlaceholder')
                      : undefined
                }
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

        <Button className="w-full" onClick={handleSubmit} disabled={loading || loadingStatus}>
          {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
          {t('loadCookieData')}
        </Button>
      </CardContent>
    </Card>
  );
}
