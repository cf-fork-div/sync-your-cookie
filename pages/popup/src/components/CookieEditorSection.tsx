import {
  SAME_SITE_OPTIONS,
  browserCookieToForm,
  formatExpiration,
  type BrowserCookieItem,
  type CookieFormData,
  useI18n,
} from '@sync-your-cookie/shared';
import {
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
import { ChevronDown, ChevronUp, RotateCw, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { usePopupBrowserCookies } from '../hooks/usePopupBrowserCookies';

type CookieEditorRowProps = {
  cookie: BrowserCookieItem;
  domainUrl: string;
  expanded: boolean;
  onToggle: () => void;
  onSave: (cookie: BrowserCookieItem, form: CookieFormData) => Promise<void>;
  onRemove: (cookie: BrowserCookieItem) => Promise<void>;
};

const ReadOnlyField = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-0.5">
    <Label className="text-[11px] text-muted-foreground">{label}</Label>
    <p className="text-xs font-mono break-all bg-muted/50 rounded px-2 py-1">{value || '-'}</p>
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

  const boolLabel = (val?: boolean | null) => (val ? t('yes') : t('no'));

  return (
    <div className="rounded-md border border-border bg-card/50 overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-muted/40"
        onClick={onToggle}>
        <span className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium truncate">{cookie.name}</span>
          {!expanded ? (
            <span className="block text-[11px] text-muted-foreground truncate font-mono">{cookie.value}</span>
          ) : null}
        </span>
      </button>

      {expanded ? (
        <div className="space-y-2 border-t border-border/60 p-2">
          <div className="space-y-0.5">
            <Label className="text-[11px]">{t('cookieName')}</Label>
            <Input className="h-7 text-xs" value={form.name} disabled />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[11px]">{t('cookieValue')}</Label>
            <textarea
              className="flex min-h-[48px] w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono"
              value={form.value}
              onChange={e => update({ value: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <Label className="text-[11px]">{t('domain')}</Label>
              <Input className="h-7 text-xs" value={form.domain} onChange={e => update({ domain: e.target.value })} />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[11px]">{t('cookiePath')}</Label>
              <Input className="h-7 text-xs" value={form.path} onChange={e => update({ path: e.target.value })} />
            </div>
          </div>
          <div className="space-y-0.5">
            <Label className="text-[11px]">{t('cookieExpires')}</Label>
            <Input
              className="h-7 text-xs"
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
          <div className="grid grid-cols-2 gap-2">
            <ReadOnlyField label={t('hostOnly')} value={boolLabel(cookie.hostOnly)} />
            <ReadOnlyField label={t('sessionCookie')} value={boolLabel(cookie.session)} />
            <ReadOnlyField label={t('storeId')} value={cookie.storeId || '-'} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving || deleting}>
              <Save size={12} className="mr-1" />
              {t('save')}
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
  enabled: boolean;
};

export function CookieEditorSection({ host, enabled }: CookieEditorSectionProps) {
  const { t } = useI18n();
  const { cookies, loading, domainUrl, refresh, handleSet, handleRemove } = usePopupBrowserCookies(host, enabled);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setExpandedId(null);
    }
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <div className="w-full mt-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{t('cookiesCount', { count: cookies.length })}</span>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => void refresh()} disabled={loading}>
          <RotateCw size={12} className={cn('mr-1', loading && 'animate-spin')} />
          {t('refresh')}
        </Button>
      </div>
      <div className="max-h-[280px] overflow-y-auto space-y-1.5 pr-0.5">
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
    </div>
  );
}
