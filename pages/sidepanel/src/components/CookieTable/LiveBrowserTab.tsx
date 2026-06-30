import { removeCookieItemUsingMessage, useI18n } from '@sync-your-cookie/shared';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  type ColumnDef,
} from '@sync-your-cookie/ui';
import {
  Braces,
  Check,
  ClipboardList,
  CloudUpload,
  Copy,
  Ellipsis,
  Eye,
  FileText,
  PencilLine,
  Plus,
  RotateCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import type { BrowserCookieItem, CookieFormData } from '../../lib/browserCookies';
import { formatExpiration } from '../../lib/browserCookies';
import { serializeHeaderString, serializeNetscape } from '../../lib/cookieFormats';
import { CookieFormDialog } from './CookieFormDialog';
import { CookieDetailPanel } from './CookieDetailPanel';
import { DeleteCookieDialog, type DeleteTarget } from './DeleteCookieDialog';
import { useLiveBrowserCookies } from './hooks/useLiveBrowserCookies';

type LiveBrowserTabProps = {
  host: string;
  storageKey: string;
  kvCookies: { name?: string | null; domain?: string | null }[];
  onPush: () => Promise<void>;
  searchStr: string;
};

type ExportFormat = 'json' | 'netscape' | 'header';

function CopyValueButton({ value }: { value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(t('copiedValue'));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  return (
    <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0" onClick={handleCopy} title={t('copyValue')}>
      {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
    </Button>
  );
}

export function LiveBrowserTab({ host, storageKey, kvCookies, onPush, searchStr }: LiveBrowserTabProps) {
  const { t } = useI18n();
  const { cookies, loading, domainUrl, refresh, handleSet, handleRemove, handleClearAll, handleImport } =
    useLiveBrowserCookies(host);
  const [formOpen, setFormOpen] = useState(false);
  const [editCookie, setEditCookie] = useState<BrowserCookieItem | null>(null);
  const [deleteCookie, setDeleteCookie] = useState<BrowserCookieItem | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [detailCookie, setDetailCookie] = useState<BrowserCookieItem | null>(null);
  const [saving, setSaving] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const filteredCookies = cookies.filter(c => {
    if (!searchStr.trim()) return true;
    const q = searchStr.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q) || c.domain.toLowerCase().includes(q);
  });

  const kvCount = kvCookies.length;
  const browserCount = cookies.length;
  const diff = browserCount - kvCount;

  const hasKvEntry = (cookie: BrowserCookieItem) =>
    kvCookies.some(kv => kv.name === cookie.name && (kv.domain === cookie.domain || !kv.domain));

  const handleSave = async (form: CookieFormData) => {
    setSaving(true);
    try {
      await handleSet(form);
      toast.success(t('setSuccess'));
    } catch {
      toast.error(t('setFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndPush = async (form: CookieFormData) => {
    await handleSave(form);
    await onPush();
  };

  const handleDeleteConfirm = async (target: DeleteTarget) => {
    if (!deleteCookie) return;
    setSaving(true);
    try {
      if (target === 'browser' || target === 'both') {
        await handleRemove(deleteCookie);
      }
      if (target === 'kv' || target === 'both') {
        await removeCookieItemUsingMessage({
          domain: storageKey,
          id: `${deleteCookie.domain}_${deleteCookie.name}`,
        });
      }
      toast.success(t('success'));
    } catch {
      toast.error(t('deleteFail'));
    } finally {
      setSaving(false);
    }
  };

  const copyExportText = (text: string, successKey: 'copiedJson' | 'copiedNetscape' | 'copiedCookieHeader') => {
    navigator.clipboard?.writeText(text).then(
      () => toast.success(t(successKey)),
      () => toast.error(t('copyFailed')),
    );
  };

  const handleExport = (format: ExportFormat) => {
    if (cookies.length === 0) {
      toast.warning(t('noCookiesToCopy'));
      return;
    }
    switch (format) {
      case 'json':
        copyExportText(JSON.stringify(cookies, null, 2), 'copiedJson');
        break;
      case 'netscape':
        copyExportText(serializeNetscape(cookies), 'copiedNetscape');
        break;
      case 'header':
        copyExportText(serializeHeaderString(cookies), 'copiedCookieHeader');
        break;
    }
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await handleImport(text, domainUrl, host);
      toast.success(t('importSuccess'));
    } catch {
      toast.error(t('importFailed'));
    }
    e.target.value = '';
  };

  const handleClearAllConfirm = async () => {
    setSaving(true);
    try {
      await handleClearAll();
      toast.success(t('clearAllSuccess'));
      setClearAllOpen(false);
    } catch {
      toast.error(t('clearAllFailed'));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<BrowserCookieItem>[] = [
    {
      accessorKey: 'name',
      header: t('cookieName'),
      cell: ({ row }) => (
        <p style={{ overflowWrap: 'anywhere' }} className="min-w-[60px] text-sm font-medium">
          {row.original.name}
        </p>
      ),
    },
    {
      accessorKey: 'value',
      header: t('cookieValue'),
      cell: ({ row }) => (
        <div className="flex items-start gap-1 min-w-[80px]">
          <p
            style={{ overflowWrap: 'anywhere' }}
            className="flex-1 max-h-[120px] overflow-auto text-sm text-orange-600 bg-muted/60 rounded px-1 py-0.5 font-mono">
            {row.original.value}
          </p>
          <CopyValueButton value={row.original.value} />
        </div>
      ),
    },
    {
      accessorKey: 'domain',
      header: t('domain'),
      cell: ({ row }) => <span className="text-xs">{row.original.domain}</span>,
    },
    {
      accessorKey: 'path',
      header: t('cookiePath'),
      cell: ({ row }) => <span className="text-xs">{row.original.path}</span>,
    },
    {
      id: 'expires',
      header: t('cookieExpires'),
      cell: ({ row }) => (
        <span className="text-xs">{formatExpiration(row.original.expirationDate, row.original.session)}</span>
      ),
    },
    {
      id: 'flags',
      header: t('cookieFlags'),
      cell: ({ row }) => {
        const flags = [];
        if (row.original.secure) flags.push('secure');
        if (row.original.httpOnly) flags.push('httpOnly');
        if (row.original.sameSite) flags.push(row.original.sameSite);
        return <span className="text-xs text-muted-foreground">{flags.join(', ') || '-'}</span>;
      },
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <Ellipsis className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => setDetailCookie(row.original)}>
              <Eye size={16} className="mr-2 h-4 w-4" />
              {t('viewDetails')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => {
                setEditCookie(row.original);
                setFormOpen(true);
              }}>
              <PencilLine size={16} className="mr-2 h-4 w-4" />
              {t('editCookie')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive"
              onClick={() => setDeleteCookie(row.original)}>
              <Trash2 size={16} className="mr-2 h-4 w-4" />
              {t('delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 mb-2 flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground">
          {t('cookieDiffHint', { browser: browserCount, kv: kvCount, diff: diff >= 0 ? `+${diff}` : String(diff) })}
        </p>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => refresh()} disabled={loading}>
          <RotateCw size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Braces size={14} className="mr-1" />
              {t('exportCookies')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="cursor-pointer" onClick={() => handleExport('json')}>
              <Braces size={16} className="mr-2 h-4 w-4" />
              {t('exportJson')}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => handleExport('netscape')}>
              <FileText size={16} className="mr-2 h-4 w-4" />
              {t('exportNetscape')}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => handleExport('header')}>
              <ClipboardList size={16} className="mr-2 h-4 w-4" />
              {t('exportHeader')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
          <Upload size={14} className="mr-1" />
          {t('importCookies')}
        </Button>
        <input
          ref={importRef}
          type="file"
          accept=".json,.txt,text/plain,application/json"
          className="hidden"
          onChange={handleImportFile}
        />
        <Button variant="outline" size="sm" onClick={onPush}>
          <CloudUpload size={14} className="mr-1" />
          {t('push')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          disabled={cookies.length === 0}
          onClick={() => setClearAllOpen(true)}>
          <Trash2 size={14} className="mr-1" />
          {t('clearAllCookies')}
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setEditCookie(null);
            setFormOpen(true);
          }}>
          <Plus size={14} className="mr-1" />
          {t('addCookie')}
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <DataTable columns={columns} data={filteredCookies} />
      </div>
      <CookieFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditCookie(null);
        }}
        onSave={handleSave}
        onSaveAndPush={handleSaveAndPush}
        initial={editCookie}
        domainUrl={domainUrl}
        defaultDomain={host}
        saving={saving}
      />
      <DeleteCookieDialog
        open={!!deleteCookie}
        cookie={deleteCookie}
        onClose={() => setDeleteCookie(null)}
        onConfirm={handleDeleteConfirm}
        hasKvEntry={deleteCookie ? hasKvEntry(deleteCookie) : false}
        saving={saving}
      />
      <AlertDialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('clearAllCookies')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('clearAllCookiesConfirm', { count: cookies.length, host })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" disabled={saving} onClick={handleClearAllConfirm}>
                {t('clearAllCookies')}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {detailCookie ? (
        <CookieDetailPanel
          cookie={{
            domain: detailCookie.domain,
            name: detailCookie.name,
            value: detailCookie.value,
            path: detailCookie.path,
            expirationDate: detailCookie.expirationDate,
            secure: detailCookie.secure,
            httpOnly: detailCookie.httpOnly,
            sameSite: detailCookie.sameSite,
            hostOnly: detailCookie.hostOnly,
            session: detailCookie.session,
            storeId: detailCookie.storeId,
          }}
          onClose={() => setDetailCookie(null)}
        />
      ) : null}
    </div>
  );
}
