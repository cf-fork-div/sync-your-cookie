import {
  SAME_SITE_OPTIONS,
  browserCookieToForm,
  formatExpiration,
  serializeCookieHeader,
  type BrowserCookieItem,
  type CookieFormData,
  useI18n,
} from '@sync-your-cookie/shared';
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
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  cn,
} from '@sync-your-cookie/ui';
import { Braces, Check, ChevronDown, ChevronUp, Copy, Plus, RotateCw, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { usePopupBrowserCookies } from '../hooks/usePopupBrowserCookies';
import { CookieFormDialog } from './CookieFormDialog';

type CookieEditorRowProps = {
  cookie: BrowserCookieItem;
  domainUrl: string;
  expanded: boolean;
  onToggle: () => void;
  onSave: (cookie: BrowserCookieItem, form: CookieFormData) => Promise<void>;
  onRemove: (cookie: BrowserCookieItem) => Promise<void>;
};

const fieldInputClass = 'h-7 text-xs min-w-0 max-w-full';
const fieldTextareaClass =
  'flex min-h-[48px] w-full min-w-0 max-w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono break-all overflow-x-hidden resize-y';

const copyToClipboard = async (text: string, onSuccess: () => void, onError: () => void) => {
  try {
    await navigator.clipboard.writeText(text);
    onSuccess();
  } catch {
    onError();
  }
};

const ReadOnlyField = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 space-y-0.5 overflow-hidden">
    <Label className="text-[11px] text-muted-foreground">{label}</Label>
    <p className="overflow-hidden break-all rounded bg-muted/50 px-2 py-1 font-mono text-xs">{value || '-'}</p>
  </div>
);

export function CookieEditorRow({
  cookie,
  domainUrl,
  expanded,
  onToggle,
  onSave,
  onRemove,
}: CookieEditorRowProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<CookieFormData>(() => browserCookieToForm(cookie, domainUrl));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedValue, setCopiedValue] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => {
    if (expanded) {
      setForm(browserCookieToForm(cookie, domainUrl));
    }
  }, [cookie, domainUrl, expanded]);

  const update = (patch: Partial<CookieFormData>) => setForm(prev => ({ ...prev, ...patch }));

  const expirationInputValue =
    form.expirationDate != null ? new Date(form.expirationDate * 1000).toISOString().slice(0, 16) : '';

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(cookie, form);
      toast.success(t('setSuccess'));
      onToggle();
    } catch {
      toast.error(t('setFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onRemove(cookie);
      toast.success(t('success'));
    } catch {
      toast.error(t('deleteFail'));
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyValue = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copyToClipboard(
      cookie.value,
      () => {
        setCopiedValue(true);
        toast.success(t('copiedValue'));
        setTimeout(() => setCopiedValue(false), 1500);
      },
      () => toast.error(t('copyFailed')),
    );
  };

  const handleCopyJson = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copyToClipboard(
      JSON.stringify(cookie, null, 2),
      () => {
        setCopiedJson(true);
        toast.success(t('copiedJson'));
        setTimeout(() => setCopiedJson(false), 1500);
      },
      () => toast.error(t('copyFailed')),
    );
  };

  const boolLabel = (val?: boolean | null) => (val ? t('yes') : t('no'));

  return (
    <div className="max-w-full min-w-0 overflow-hidden rounded-md border border-border bg-card/50">
      <div className="flex w-full items-center gap-1">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left hover:bg-muted/40"
          onClick={onToggle}>
          <span className="shrink-0 text-muted-foreground">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
          <span className="min-w-0 flex-1 overflow-hidden">
            <span className="block text-xs font-medium text-foreground truncate">{cookie.name || '-'}</span>
            {!expanded ? (
              <>
                <span
                  style={{ overflowWrap: 'anywhere' }}
                  className="block text-[11px] text-orange-600 dark:text-orange-400 line-clamp-2 font-mono bg-muted/50 rounded px-1 mt-0.5">
                  {cookie.value || '-'}
                </span>
                <span className="block text-[10px] text-muted-foreground truncate mt-0.5">
                  {cookie.domain}
                  {cookie.path ? ` · ${cookie.path}` : ''}
                </span>
              </>
            ) : null}
          </span>
        </button>
        {!expanded ? (
          <div className="flex shrink-0 items-center gap-0.5 pr-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleCopyValue}
              title={t('copyValue')}>
              {copiedValue ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopyJson} title={t('copyJson')}>
              {copiedJson ? <Check size={12} className="text-green-600" /> : <Braces size={12} />}
            </Button>
          </div>
        ) : null}
      </div>

      {expanded ? (
        <div className="min-w-0 space-y-2 overflow-hidden border-t border-border/60 p-2">
          <div className="min-w-0 space-y-0.5 overflow-hidden">
            <Label className="text-[11px]">{t('cookieName')}</Label>
            <Input className={fieldInputClass} value={form.name} disabled />
          </div>
          <div className="min-w-0 space-y-0.5 overflow-hidden">
            <Label className="text-[11px]">{t('cookieValue')}</Label>
            <textarea
              className={fieldTextareaClass}
              style={{ overflowWrap: 'anywhere' }}
              value={form.value}
              onChange={e => update({ value: e.target.value })}
            />
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <div className="min-w-0 space-y-0.5 overflow-hidden">
              <Label className="text-[11px]">{t('domain')}</Label>
              <Input className={fieldInputClass} value={form.domain} onChange={e => update({ domain: e.target.value })} />
            </div>
            <div className="min-w-0 space-y-0.5 overflow-hidden">
              <Label className="text-[11px]">{t('cookiePath')}</Label>
              <Input className={fieldInputClass} value={form.path} onChange={e => update({ path: e.target.value })} />
            </div>
          </div>
          <div className="min-w-0 space-y-0.5 overflow-hidden">
            <Label className="text-[11px]">{t('cookieExpires')}</Label>
            <Input
              className={fieldInputClass}
              type="datetime-local"
              value={expirationInputValue}
              onChange={e => {
                const val = e.target.value;
                update({
                  expirationDate: val ? Math.floor(new Date(val).getTime() / 1000) : null,
                });
              }}
            />
            <p className="text-[10px] text-muted-foreground">
              {t('sessionCookie')}: {formatExpiration(cookie.expirationDate, cookie.session)}
            </p>
          </div>
          <div className="space-y-0.5">
            <Label className="text-[11px]">{t('cookieSameSite')}</Label>
            <Select
              value={form.sameSite}
              onValueChange={val => update({ sameSite: val as chrome.cookies.SameSiteStatus })}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SAME_SITE_OPTIONS.map(opt => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Switch checked={form.secure} onCheckedChange={val => update({ secure: val })} id={`secure-${cookie.id}`} />
              <Label htmlFor={`secure-${cookie.id}`} className="text-[11px]">
                {t('cookieSecure')}
              </Label>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch
                checked={form.httpOnly}
                onCheckedChange={val => update({ httpOnly: val })}
                id={`httpOnly-${cookie.id}`}
              />
              <Label htmlFor={`httpOnly-${cookie.id}`} className="text-[11px]">
                {t('cookieHttpOnly')}
              </Label>
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <ReadOnlyField label={t('hostOnly')} value={boolLabel(cookie.hostOnly)} />
            <ReadOnlyField label={t('sessionCookie')} value={boolLabel(cookie.session)} />
            <ReadOnlyField label={t('storeId')} value={cookie.storeId || '-'} />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving || deleting}>
              <Save size={12} className="mr-1" />
              {t('save')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleCopyValue}
              disabled={saving || deleting}>
              <Copy size={12} className="mr-1" />
              {t('copyValue')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleCopyJson}
              disabled={saving || deleting}>
              <Braces size={12} className="mr-1" />
              {t('copyJson')}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              onClick={handleDelete}
              disabled={saving || deleting}>
              <Trash2 size={12} className="mr-1" />
              {t('delete')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type CookieEditorSectionProps = {
  host: string;
  tabUrl?: string;
  enabled: boolean;
};

export function CookieEditorSection({ host, tabUrl, enabled }: CookieEditorSectionProps) {
  const { t } = useI18n();
  const { cookies, loading, domainUrl, refresh, handleSet, handleAdd, handleRemove, handleClearAll } =
    usePopupBrowserCookies(host, enabled, tabUrl);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setExpandedId(null);
      setClearAllOpen(false);
      setFormOpen(false);
    }
  }, [enabled]);

  const handleClearAllConfirm = async () => {
    setClearing(true);
    try {
      await handleClearAll();
      toast.success(t('clearAllSuccess'));
      setClearAllOpen(false);
      setExpandedId(null);
    } catch {
      toast.error(t('clearAllFailed'));
    } finally {
      setClearing(false);
    }
  };

  const handleCopyAllHeader = () => {
    if (cookies.length === 0) {
      toast.warning(t('noCookiesToCopy'));
      return;
    }
    const text = serializeCookieHeader(cookies);
    if (!text) {
      toast.warning(t('noCookiesToCopy'));
      return;
    }
    void copyToClipboard(
      text,
      () => toast.success(t('copiedCookieHeader')),
      () => toast.error(t('copyFailed')),
    );
  };

  const handleCopyAllJson = () => {
    if (cookies.length === 0) {
      toast.warning(t('noCookiesToCopy'));
      return;
    }
    void copyToClipboard(
      JSON.stringify(cookies, null, 2),
      () => toast.success(t('copiedJson')),
      () => toast.error(t('copyFailed')),
    );
  };

  const handleAddCookie = async (form: CookieFormData) => {
    setSaving(true);
    try {
      await handleAdd(form);
      toast.success(t('setSuccess'));
    } catch {
      toast.error(t('setFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!enabled) {
    return null;
  }

  return (
    <div className="mt-2 w-full min-w-0 overflow-hidden">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
        <span className="text-xs text-muted-foreground">{t('cookiesCount', { count: cookies.length })}</span>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setFormOpen(true)}
            title={t('addCookie')}>
            <Plus size={12} className="mr-1" />
            {t('addCookie')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={cookies.length === 0}
            onClick={handleCopyAllHeader}
            title={t('copyCookieHeader')}>
            <Copy size={12} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={cookies.length === 0}
            onClick={handleCopyAllJson}
            title={t('copyJson')}>
            <Braces size={12} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-destructive hover:text-destructive"
            disabled={loading || cookies.length === 0}
            onClick={() => setClearAllOpen(true)}
            title={t('clearAllCookies')}>
            <Trash2 size={12} />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => void refresh()} disabled={loading}>
            <RotateCw size={12} className={cn('mr-1', loading && 'animate-spin')} />
            {t('refresh')}
          </Button>
        </div>
      </div>
      <div className="max-h-[280px] min-w-0 space-y-1.5 overflow-y-auto overflow-x-hidden pr-0.5">
        {loading && cookies.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">{t('loading')}</p>
        ) : cookies.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">{t('noCookiesForHost')}</p>
        ) : (
          cookies.map(cookie => (
            <CookieEditorRow
              key={cookie.id}
              cookie={cookie}
              domainUrl={domainUrl}
              expanded={expandedId === cookie.id}
              onToggle={() => setExpandedId(prev => (prev === cookie.id ? null : cookie.id))}
              onSave={handleSet}
              onRemove={handleRemove}
            />
          ))
        )}
      </div>
      <CookieFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleAddCookie}
        domainUrl={domainUrl}
        defaultDomain={host}
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
            <AlertDialogCancel disabled={clearing}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" disabled={clearing} onClick={() => void handleClearAllConfirm()}>
                {t('clearAllCookies')}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
