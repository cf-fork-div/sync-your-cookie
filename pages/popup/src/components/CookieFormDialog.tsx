import {
  SAME_SITE_OPTIONS,
  browserCookieToForm,
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
} from '@sync-your-cookie/ui';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

type CookieFormDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (form: CookieFormData) => Promise<void>;
  initial?: BrowserCookieItem | null;
  domainUrl: string;
  defaultDomain: string;
  saving?: boolean;
};

const fieldInputClass = 'h-7 text-xs min-w-0 max-w-full';
const fieldTextareaClass =
  'flex min-h-[48px] w-full min-w-0 max-w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono break-all overflow-x-hidden resize-y';

const emptyForm = (domain: string, url: string): CookieFormData => ({
  name: '',
  value: '',
  domain,
  path: '/',
  expirationDate: null,
  secure: false,
  httpOnly: false,
  sameSite: 'unspecified',
  url,
});

export function CookieFormDialog({
  open,
  onClose,
  onSave,
  initial,
  domainUrl,
  defaultDomain,
  saving = false,
}: CookieFormDialogProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<CookieFormData>(() => emptyForm(defaultDomain, domainUrl));

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm(browserCookieToForm(initial, domainUrl));
    } else {
      setForm(emptyForm(defaultDomain, domainUrl));
    }
  }, [open, initial, domainUrl, defaultDomain]);

  if (!open) return null;

  const update = (patch: Partial<CookieFormData>) => setForm(prev => ({ ...prev, ...patch }));

  const handleSubmit = async () => {
    await onSave(form);
    onClose();
  };

  const expirationInputValue =
    form.expirationDate != null ? new Date(form.expirationDate * 1000).toISOString().slice(0, 16) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2">
      <div className="w-full max-w-[380px] rounded-lg border bg-background p-3 shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{initial ? t('editCookie') : t('addCookie')}</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="space-y-2">
          <div className="min-w-0 space-y-0.5 overflow-hidden">
            <Label className="text-[11px]">{t('cookieName')}</Label>
            <Input
              className={fieldInputClass}
              value={form.name}
              onChange={e => update({ name: e.target.value })}
              disabled={!!initial}
            />
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
              <Switch checked={form.secure} onCheckedChange={val => update({ secure: val })} id="popup-secure" />
              <Label htmlFor="popup-secure" className="text-[11px]">
                {t('cookieSecure')}
              </Label>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch checked={form.httpOnly} onCheckedChange={val => update({ httpOnly: val })} id="popup-httpOnly" />
              <Label htmlFor="popup-httpOnly" className="text-[11px]">
                {t('cookieHttpOnly')}
              </Label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onClose} disabled={saving}>
            {t('cancel')}
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={() => void handleSubmit()} disabled={saving || !form.name}>
            {t('save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
