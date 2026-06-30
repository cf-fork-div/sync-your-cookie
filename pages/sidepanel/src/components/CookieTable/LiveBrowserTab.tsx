import { removeCookieItemUsingMessage, useI18n } from '@sync-your-cookie/shared';
import {
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  type ColumnDef,
} from '@sync-your-cookie/ui';
import { Braces, CloudUpload, Ellipsis, PencilLine, Plus, RotateCw, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import type { BrowserCookieItem, CookieFormData } from '../../lib/browserCookies';
import { formatExpiration } from '../../lib/browserCookies';
import { CookieFormDialog } from './CookieFormDialog';
import { DeleteCookieDialog, type DeleteTarget } from './DeleteCookieDialog';
import { useLiveBrowserCookies } from './hooks/useLiveBrowserCookies';

type LiveBrowserTabProps = {
  host: string;
  kvCookies: { name?: string | null; domain?: string | null }[];
  onPush: () => Promise<void>;
  searchStr: string;
};

export function LiveBrowserTab({ host, kvCookies, onPush, searchStr }: LiveBrowserTabProps) {
  const { t } = useI18n();
  const { cookies, loading, domainUrl, refresh, handleSet, handleRemove, handleImport } = useLiveBrowserCookies(host);
  const [formOpen, setFormOpen] = useState(false);
  const [editCookie, setEditCookie] = useState<BrowserCookieItem | null>(null);
  const [deleteCookie, setDeleteCookie] = useState<BrowserCookieItem | null>(null);
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
          domain: host,
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

  const handleExport = () => {
    if (cookies.length === 0) {
      toast.warning(t('noCookiesToCopy'));
      return;
    }
    const json = JSON.stringify(cookies, null, 2);
    navigator.clipboard?.writeText(json).then(
      () => toast.success(t('copiedJson')),
      () => toast.error(t('copyFailed')),
    );
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await handleImport(text, domainUrl);
      toast.success(t('importSuccess'));
    } catch {
      toast.error(t('importFailed'));
    }
    e.target.value = '';
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
        <p
          style={{ overflowWrap: 'anywhere' }}
          className="min-w-[80px] max-h-[120px] overflow-auto text-sm text-orange-600 bg-muted/60 rounded px-1 py-0.5 font-mono">
          {row.original.value}
        </p>
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
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Braces size={14} className="mr-1" />
          {t('exportJson')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
          <Upload size={14} className="mr-1" />
          {t('importJson')}
        </Button>
        <input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile} />
        <Button variant="outline" size="sm" onClick={onPush}>
          <CloudUpload size={14} className="mr-1" />
          {t('push')}
        </Button>
        <Button size="sm" onClick={() => { setEditCookie(null); setFormOpen(true); }}>
          <Plus size={14} className="mr-1" />
          {t('addCookie')}
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <DataTable columns={columns} data={filteredCookies} />
      </div>
      <CookieFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditCookie(null); }}
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
    </div>
  );
}
