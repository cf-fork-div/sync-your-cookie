import { copyText, formatCookieHeader } from '@src/lib/cookies';
import type { ICookie, ICookiesMap, ILocalStorageItem } from '@sync-your-cookie/protobuf';
import { useI18n } from '@sync-your-cookie/shared';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Input,
  Label,
  cn,
} from '@sync-your-cookie/ui';
import { Braces, Check, Copy, Database, KeyRound, Pencil, Save, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type DomainCookieData = NonNullable<ICookiesMap['domainCookieMap']>[string];

type CookieDetailProps = {
  domain: string;
  data: DomainCookieData;
  search: string;
  canWrite: boolean;
  saving: boolean;
  onEditCookie: (oldItem: ICookie, newItem: ICookie) => Promise<void>;
  onDeleteCookie: (cookie: ICookie) => Promise<void>;
  onEditLocalStorage: (key: string, value: string) => Promise<void>;
  onDeleteLocalStorage: (key: string) => Promise<void>;
  onDeleteDomain: () => Promise<void>;
};

type ViewTab = 'cookies' | 'localStorage';

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await copyText(text);
      setCopied(true);
      toast.success(label ? t('copiedLabel', { label }) : t('copySuccessShort'));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t('copyFailedShort'));
    }
  };

  return (
    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleCopy}>
      {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
    </Button>
  );
}

function CookieRow({
  cookie,
  query,
  canWrite,
  saving,
  onEdit,
  onDelete,
}: {
  cookie: ICookie;
  query: string;
  canWrite: boolean;
  saving: boolean;
  onEdit: (oldItem: ICookie, newItem: ICookie) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(cookie.name || '');
  const [draftValue, setDraftValue] = useState(cookie.value || '');

  const highlight =
    query.trim() &&
    (cookie.name?.toLowerCase().includes(query.toLowerCase()) ||
      cookie.value?.toLowerCase().includes(query.toLowerCase()));

  const startEdit = () => {
    setDraftName(cookie.name || '');
    setDraftValue(cookie.value || '');
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await onEdit(cookie, {
        ...cookie,
        name: draftName,
        value: draftValue,
      });
      setEditing(false);
    } catch {
      // toast handled upstream
    }
  };

  return (
    <div className={cn('rounded-md border border-border p-3 space-y-2', highlight && 'ring-1 ring-primary/40')}>
      {editing ? (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={draftName} onChange={e => setDraftName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Value</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              value={draftValue}
              onChange={e => setDraftValue(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save size={14} className="mr-1" />
              保存
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              <X size={14} className="mr-1" />
              取消
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <KeyRound size={14} className="text-muted-foreground shrink-0" />
                <span className="font-medium text-sm break-all">{cookie.name}</span>
              </div>
              <p className="mt-1.5 text-sm text-orange-600 break-all bg-muted/60 rounded px-2 py-1.5 font-mono">
                {cookie.value}
              </p>
            </div>
            <div className="flex shrink-0 gap-0.5">
              <CopyButton text={cookie.value || ''} label={cookie.name || 'value'} />
              {cookie.name && cookie.value && <CopyButton text={`${cookie.name}=${cookie.value}`} label="name=value" />}
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={startEdit} disabled={saving}>
                <Pencil size={14} />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" disabled={saving}>
                    <Trash2 size={14} />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>删除 Cookie</AlertDialogTitle>
                    <AlertDialogDescription>
                      确定删除 <strong>{cookie.name}</strong> 吗？
                      {canWrite ? t('deleteSyncToCloud') : t('deleteExportNote')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>删除</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {cookie.domain && <span>domain: {cookie.domain}</span>}
            {cookie.path && <span>path: {cookie.path}</span>}
            {cookie.secure && <span>secure</span>}
            {cookie.httpOnly && <span>httpOnly</span>}
            {cookie.sameSite && <span>sameSite: {cookie.sameSite}</span>}
          </div>
        </>
      )}
    </div>
  );
}

function LocalStorageRow({
  item,
  query,
  canWrite,
  saving,
  onEdit,
  onDelete,
}: {
  item: ILocalStorageItem;
  query: string;
  canWrite: boolean;
  saving: boolean;
  onEdit: (key: string, value: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(item.value || '');

  const highlight =
    query.trim() &&
    (item.key?.toLowerCase().includes(query.toLowerCase()) || item.value?.toLowerCase().includes(query.toLowerCase()));

  const handleSave = async () => {
    try {
      await onEdit(item.key || '', draftValue);
      setEditing(false);
    } catch {
      // toast handled upstream
    }
  };

  return (
    <div className={cn('rounded-md border border-border p-3 space-y-2', highlight && 'ring-1 ring-primary/40')}>
      {editing ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">{item.key}</div>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            value={draftValue}
            onChange={e => setDraftValue(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save size={14} className="mr-1" />
              保存
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              取消
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Database size={14} className="text-muted-foreground shrink-0" />
              <span className="font-medium text-sm break-all">{item.key}</span>
            </div>
            <p className="mt-1.5 text-sm text-orange-600 break-all bg-muted/60 rounded px-2 py-1.5 font-mono max-h-40 overflow-auto">
              {item.value}
            </p>
          </div>
          <div className="flex shrink-0 gap-0.5">
            <CopyButton text={item.value || ''} label={item.key || 'value'} />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => {
                setDraftValue(item.value || '');
                setEditing(true);
              }}
              disabled={saving}>
              <Pencil size={14} />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" disabled={saving}>
                  <Trash2 size={14} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>删除 LocalStorage</AlertDialogTitle>
                  <AlertDialogDescription>
                    确定删除 <strong>{item.key}</strong> 吗？
                    {canWrite ? t('deleteSyncToCloud') : t('deleteExportNoteShort')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>删除</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}

export function CookieDetail({
  domain,
  data,
  search,
  canWrite,
  saving,
  onEditCookie,
  onDeleteCookie,
  onEditLocalStorage,
  onDeleteLocalStorage,
  onDeleteDomain,
}: CookieDetailProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<ViewTab>('cookies');

  const cookies = useMemo(() => {
    const list = data.cookies || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(c => c.name?.toLowerCase().includes(q) || c.value?.toLowerCase().includes(q));
  }, [data.cookies, search]);

  const localStorageItems = useMemo(() => {
    const list = data.localStorageItems || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(item => item.key?.toLowerCase().includes(q) || item.value?.toLowerCase().includes(q));
  }, [data.localStorageItems, search]);

  const handleCopyAllHeader = async () => {
    const text = formatCookieHeader(domain, data.cookies || []);
    if (!text) {
      toast.warning(t('noCookiesToCopy'));
      return;
    }
    try {
      await copyText(text);
      toast.success(t('copiedCookieHeader'));
    } catch {
      toast.error(t('copyFailedShort'));
    }
  };

  const handleCopyAllJson = async () => {
    const text = JSON.stringify(data.cookies || [], null, 2);
    if (!text || text === '[]') {
      toast.warning(t('noCookiesToCopy'));
      return;
    }
    try {
      await copyText(text);
      toast.success(t('copiedJson'));
    } catch {
      toast.error(t('copyFailedShort'));
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col min-h-[60vh]">
      <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold text-base">{domain}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {cookies.length} cookies
            {localStorageItems.length > 0 ? ` · ${localStorageItems.length} localStorage` : ''}
            {data.userAgent ? ` · ${data.userAgent.slice(0, 40)}...` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyAllHeader}>
            <Copy size={14} className="mr-1.5" />
            {t('copyCookieHeader')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyAllJson}>
            <Braces size={14} className="mr-1.5" />
            {t('copyJson')}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={saving}>
                <Trash2 size={14} className="mr-1.5" />
                {t('deleteDomain')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>删除整个域名</AlertDialogTitle>
                <AlertDialogDescription>
                  确定删除 <strong>{domain}</strong> 下的全部 Cookie 和 LocalStorage 吗？
                  {canWrite ? t('deleteSyncToCloud') : t('deleteExportNoteShort')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={onDeleteDomain}>{t('delete')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="px-4 pt-3 flex gap-2 border-b border-border">
        <Button variant={tab === 'cookies' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('cookies')}>
          Cookies ({cookies.length})
        </Button>
        {(localStorageItems.length > 0 || canWrite) && (
          <Button
            variant={tab === 'localStorage' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTab('localStorage')}>
            LocalStorage ({localStorageItems.length})
          </Button>
        )}
      </div>

      <div className="p-4 space-y-3 overflow-y-auto flex-1 max-h-[70vh]">
        {tab === 'cookies' &&
          (cookies.length > 0 ? (
            cookies.map((cookie, index) => (
              <CookieRow
                key={`${cookie.name}-${cookie.domain}-${index}`}
                cookie={cookie}
                query={search}
                canWrite={canWrite}
                saving={saving}
                onEdit={onEditCookie}
                onDelete={() => onDeleteCookie(cookie)}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">该域名下没有 Cookie</p>
          ))}

        {tab === 'localStorage' &&
          (localStorageItems.length > 0 ? (
            localStorageItems.map((item, index) => (
              <LocalStorageRow
                key={`${item.key}-${index}`}
                item={item}
                query={search}
                canWrite={canWrite}
                saving={saving}
                onEdit={onEditLocalStorage}
                onDelete={() => onDeleteLocalStorage(item.key || '')}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">该域名下没有 LocalStorage</p>
          ))}
      </div>
    </div>
  );
}
