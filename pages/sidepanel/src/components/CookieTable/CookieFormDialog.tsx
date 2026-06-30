import { useI18n } from '@sync-your-cookie/shared';
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
import type { BrowserCookieItem, CookieFormData } from '../../lib/browserCookies';
import { SAME_SITE_OPTIONS, browserCookieToForm } from '../../lib/browserCookies';

type CookieFormDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (form: CookieFormData) => Promise<void>;
  onSaveAndPush?: (form: CookieFormData) => Promise<void>;
  initial?: BrowserCookieItem | null;
  domainUrl: string;
  defaultDomain: string;
  saving?: boolean;
};

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
  onSaveAndPush,
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

  const update = (patch: Partial<CookieFormData>) => setForm((prev: CookieFormData) => ({ ...prev, ...patch }));

  const handleSubmit = async (andPush = false) => {
    const handler = andPush && onSaveAndPush ? onSaveAndPush : onSave;
    await handler(form);
    onClose();
  };

  const expirationInputValue =
    form.expirationDate != null
      ? new Date(form.expirationDate * 1000).toISOString().slice(0, 16)
      : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border bg-background p-4 shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{initial ? t('editCookie') : t('addCookie')}</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{t('cookieName')}</Label>
            <Input value={form.name} onChange={e => update({ name: e.target.value })} disabled={!!initial} />
          </div>
          <div className="space-y-1">
            <Label>{t('cookieValue')}</Label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              value={form.value}
              onChange={e => update({ value: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('domain')}</Label>
            <Input value={form.domain} onChange={e => update({ domain: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>{t('cookiePath')}</Label>
            <Input value={form.path} onChange={e => update({ path: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>{t('cookieExpires')}</Label>
            <Input
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
          <div className="space-y-1">
            <Label>{t('cookieSameSite')}</Label>
            <Select value={form.sameSite} onValueChange={val => update({ sameSite: val as chrome.cookies.SameSiteStatus })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SAME_SITE_OPTIONS.map((opt: chrome.cookies.SameSiteStatus) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={form.secure} onCheckedChange={val => update({ secure: val })} id="secure" />
              <Label htmlFor="secure">{t('cookieSecure')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.httpOnly} onCheckedChange={val => update({ httpOnly: val })} id="httpOnly" />
              <Label htmlFor="httpOnly">{t('cookieHttpOnly')}</Label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('cancel')}
          </Button>
          <Button onClick={() => handleSubmit(false)} disabled={saving || !form.name}>
            {t('save')}
          </Button>
          {onSaveAndPush && (
            <Button onClick={() => handleSubmit(true)} disabled={saving || !form.name}>
              {t('saveAndPush')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
